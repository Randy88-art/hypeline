<script lang="ts">
	import dayjs from "dayjs";
	import duration from "dayjs/plugin/duration";
	import { onMount } from "svelte";
	import type { Stream } from "$lib/twitch/api";

	dayjs.extend(duration);

	const { stream }: { stream: Stream } = $props();

	let uptime = $state(getUptime());

	onMount(() => {
		let interval: number | undefined;

		setTimeout(() => {
			interval = setInterval(() => {
				uptime = getUptime();
			}, 1000);
		}, 1000 - new Date().getMilliseconds());

		return () => clearInterval(interval);
	});

	function getUptime() {
		const diff = dayjs.duration(dayjs().diff(dayjs(stream.started_at)));
		const hours = Math.floor(diff.asHours()).toString().padStart(2, "0");

		return `${hours}:${diff.format("mm:ss")}`;
	}
</script>

<div
	class="bg-sidebar text-muted-foreground flex items-center justify-between overflow-hidden border-b p-2 text-xs"
>
	<p class="truncate" title={stream.title}>{stream.title}</p>

	<div class="ml-[3ch] flex items-center gap-1">
		<div class="flex items-center">
			<span class="iconify lucide--users mr-1"></span>
			<span class="font-medium">{stream.viewer_count}</span>
		</div>

		&bullet;

		<div class="flex items-center">
			<span class="iconify lucide--clock mr-1"></span>
			<span class="font-medium tabular-nums">{uptime}</span>
		</div>
	</div>
</div>
