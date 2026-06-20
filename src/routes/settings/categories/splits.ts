import Layout from "~icons/ph/layout";
import type { SettingsCategory } from "../types";

export default {
	order: 15,
	label: "Splits",
	icon: Layout,
	fields: [
		{
			id: "splits.defaultOrientation",
			type: "radio",
			label: "Default orientation",
			description:
				"Choose the default orientation when opening a new split with the keyboard.",
			items: [
				{
					label: "Horizontal",
					value: "horizontal",
					description: "New splits will open to the right of the focused split.",
				},
				{
					label: "Vertical",
					value: "vertical",
					description: "New splits will open below the focused split.",
				},
			],
		},
		{
			id: "splits.closeBehavior",
			type: "radio",
			label: "Close behavior",
			description: "Choose what happens when closing a split.",
			items: [
				{
					label: "Preserve",
					value: "preserve",
					description:
						"Preserve the existing layout by replacing it with an empty split. If the split is already empty, it will be removed. Splits can be force closed with this option by Shift clicking close.",
				},
				{
					label: "Remove",
					value: "remove",
					description:
						"Remove it from the layout and adjust remaining splits accordingly.",
				},
			],
		},
		{
			id: "splits.leaveOnClose",
			type: "switch",
			label: "Leave channel on close",
			description: "Automatically leave the channel contained in a split when closing it.",
		},
	],
} satisfies SettingsCategory;
