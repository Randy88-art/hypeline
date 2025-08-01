import { invoke } from "@tauri-apps/api/core";
import { SvelteMap } from "svelte/reactivity";
import { PUBLIC_TWITCH_CLIENT_ID } from "$env/static/public";
import { log } from "./log";
import { SystemMessage } from "./message";
import type { Message } from "./message";
import { settings } from "./settings";
import type { EmoteSet } from "./seventv";
import { app } from "./state.svelte";
import type { Emote, JoinedChannel } from "./tauri";
import type { Badge, BadgeSet, Cheermote, Stream } from "./twitch/api";
import { User } from "./user.svelte";
import { find } from "./util";

const RATE_LIMIT_WINDOW = 30 * 1000;
const RATE_LIMIT_GRACE = 1000;

export class Channel {
	#stream = $state<Stream | null>(null);
	#bypassNext = false;
	#lastRecentAt: number | null = null;

	#lastMessage: number[] = [];
	#lastMessageElevated: number[] = [];
	#lastHitSpdAt: number;
	#lastHitAmtAt: number;

	public readonly badges = new SvelteMap<string, Record<string, Badge>>();
	public readonly emotes = new SvelteMap<string, Emote>();
	public readonly cheermotes = $state<Cheermote[]>([]);
	public readonly viewers = new SvelteMap<string, User>();

	/**
	 * Whether the channel is ephemeral.
	 */
	public ephemeral = false;

	/**
	 * The active 7TV emote set for the channel if any.
	 */
	public emoteSet = $state<EmoteSet>();

	/**
	 * An array of messages the user has sent in the channel.
	 */
	public history = $state<string[]>([]);
	public messages = $state<Message[]>([]);

	public constructor(
		/**
		 * The user for the channel.
		 */
		public readonly user: User,
		stream: Stream | null = null,
	) {
		this.#stream = stream;

		this.user.isBroadcaster = true;
		this.viewers.set(user.id, user);

		const now = performance.now();

		this.#lastHitSpdAt = now - RATE_LIMIT_WINDOW * 2;
		this.#lastHitAmtAt = now - RATE_LIMIT_WINDOW * 2;
	}

	public static async join(login: string) {
		const joined = await invoke<JoinedChannel>("join", {
			login,
			isMod: app.user ? !!find(app.user.moderating, (name) => name === login) : false,
		});

		let channel = app.channels.find((c) => c.user.username === login);

		if (!channel) {
			const user = new User(joined.user);
			channel = new Channel(user);
		}

		channel = channel
			.addBadges(joined.badges)
			.addEmotes(joined.emotes)
			.addCheermotes(joined.cheermotes)
			.setStream(joined.stream);

		channel.emoteSet = joined.emote_set ?? undefined;

		return channel;
	}

	/**
	 * The stream associated with the channel if it's currently streaming.
	 */
	public get stream() {
		return this.#stream;
	}

	public async leave() {
		await invoke("leave", { channel: this.user.username });
	}

	public addBadges(badges: BadgeSet[]) {
		for (const set of badges) {
			const badges: Record<string, Badge> = {};

			for (const version of set.versions) {
				badges[version.id] = version;
			}

			this.badges.set(set.set_id, badges);
		}

		return this;
	}

	public addCheermotes(cheermotes: Cheermote[]) {
		for (const cheermote of cheermotes) {
			this.cheermotes.push(cheermote);
		}

		return this;
	}

	public addEmotes(emotes: Record<string, Emote> | Map<string, Emote>) {
		const entries = emotes instanceof Map ? emotes : Object.entries(emotes);

		for (const [name, emote] of entries) {
			this.emotes.set(name, emote);
		}

		return this;
	}

	public addMessage(message: Message) {
		if (this.messages.some((m) => m.id === message.id)) {
			return this;
		}

		if (message.isRecent) {
			if (this.#lastRecentAt === null) {
				this.messages.unshift(message);
				this.#lastRecentAt = 0;
			} else {
				this.messages.splice(this.#lastRecentAt + 1, 0, message);
				this.#lastRecentAt++;
			}
		} else {
			this.messages.push(message);
		}

		return this;
	}

	public clearMessages(id?: string) {
		if (id) {
			for (const message of this.messages) {
				if (message.isUser() && message.author.id === id) {
					message.setDeleted();
				}
			}
		} else {
			for (const message of this.messages) {
				// System messages can also be deleted, but there's no reliable
				// way to identify which ones (that doesn't involve more
				// complexity), so they're only deleted if it's recent.
				if (message.isUser()) message.setDeleted();
			}
		}
	}

	public async send(message: string, replyId?: string) {
		if (!app.user) return;
		const user = this.viewers.get(app.user.id) ?? app.user;

		const elevated = user.isMod || user.isVip;

		const rateLimited = this.#checkRateLimit(elevated);
		if (rateLimited) return;

		if (!elevated && settings.state.chat.bypassDuplicate && this.history.at(-1) === message) {
			this.#bypassNext = !this.#bypassNext;

			if (this.#bypassNext) {
				message = `${message} \u{E0000}`;
			}
		} else {
			this.#bypassNext = false;
		}

		log.info(`Sending message in ${this.user.username} (${this.user.id})`);

		const response = await fetch("https://api.twitch.tv/helix/chat/messages", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Client-ID": PUBLIC_TWITCH_CLIENT_ID,
				Authorization: `Bearer ${settings.state.user?.token}`,
			},
			body: JSON.stringify({
				broadcaster_id: this.user.id,
				sender_id: user.id,
				reply_parent_message_id: replyId,
				message,
			}),
		});

		const body = await response.json();
		const sysmsg = new SystemMessage();

		if (body.status === 429) {
			log.warn(`Rate limit exceeded: ${body.message}`);
			this.addMessage(sysmsg.setText(body.message));
		} else if (response.ok) {
			if (body.data[0].is_sent) {
				log.info("Message sent");
				await invoke("send_presence", { channelId: this.user.id });
			} else {
				const reason = body.data[0].drop_reason.message;

				log.warn(`Message dropped: ${reason}`);
				this.addMessage(sysmsg.setText(reason));
			}
		}
	}

	public setStream(stream: Stream | null) {
		this.#stream = stream;
		return this;
	}

	public setEphemeral() {
		this.ephemeral = true;
		return this;
	}

	#checkRateLimit(elevated: boolean) {
		const now = performance.now();

		const queue = elevated ? this.#lastMessageElevated : this.#lastMessage;
		const maxMsgCount = elevated ? 99 : 19;
		const minMsgOffset = elevated ? 100 : 1100;

		const last = queue.at(-1);

		if (last && last + minMsgOffset > now) {
			if (this.#lastHitSpdAt + RATE_LIMIT_WINDOW < now) {
				this.#lastHitSpdAt = now;
			}

			return true;
		}

		while (queue.length && queue[0] + RATE_LIMIT_WINDOW + RATE_LIMIT_GRACE < now) {
			queue.shift();
		}

		if (queue.length >= maxMsgCount) {
			if (this.#lastHitAmtAt + RATE_LIMIT_WINDOW < now) {
				this.#lastHitAmtAt = now;
			}

			return true;
		}

		queue.push(now);
		return false;
	}
}
