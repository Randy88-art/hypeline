<script lang="ts" module>
	interface BaseSuggestion {
		value: string;
		display: string;
	}

	interface EmoteSuggestion extends BaseSuggestion {
		type: "emote";
		imageUrl: string;
	}

	interface UserSuggestion extends BaseSuggestion {
		type: "user";
		style: string;
	}

	export type Suggestion = EmoteSuggestion | UserSuggestion;
</script>

<script lang="ts">
	import { Combobox } from "bits-ui";

	interface Props {
		anchor: HTMLElement | null;
		open: boolean;
		index: number;
		suggestions: Suggestion[];
		onselect: (suggestion: Suggestion) => void;
	}

	let { anchor, open = $bindable(), index, suggestions, onselect }: Props = $props();

	const items = $state<(HTMLDivElement | null)[]>(Array.from({ length: 25 }, () => null));

	$effect(() => {
		items[index]?.scrollIntoView({ block: "nearest" });
	});
</script>

<Combobox.Root
	type="single"
	onValueChange={(value) => {
		const suggestion = suggestions.find((s) => s.value === value);
		if (suggestion) onselect(suggestion);
	}}
	bind:open
>
	<Combobox.Portal>
		<Combobox.Content
			class="bg-card z-50 max-h-72 w-(--bits-combobox-anchor-width) overflow-y-auto rounded-md border p-1 shadow-lg"
			customAnchor={anchor}
			side="top"
			sideOffset={8}
		>
			{#each suggestions as suggestion, i (suggestion.value)}
				<Combobox.Item
					class={[
						"flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:cursor-pointer",
						"data-current:bg-accent data-current:text-accent-foreground",
					]}
					title={suggestion.display}
					value={suggestion.value}
					data-current={index === i ? true : null}
					onmouseenter={() => (index = i)}
					bind:ref={items[i]}
				>
					{#if suggestion.type === "emote"}
						<img
							class="size-8 object-contain"
							src={suggestion.imageUrl}
							alt={suggestion.display}
						/>

						<span class="overflow-x-hidden overflow-ellipsis">
							{suggestion.display}
						</span>
					{:else}
						<span class="font-semibold" style={suggestion.style}>
							{suggestion.display}
						</span>
					{/if}
				</Combobox.Item>
			{/each}
		</Combobox.Content>
	</Combobox.Portal>
</Combobox.Root>
