CREATE TABLE `example_order_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_code` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`line_amount` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `example_orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `example_order_lines_order_id_idx` ON `example_order_lines` (`order_id`);--> statement-breakpoint
CREATE TABLE `example_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'placed' NOT NULL,
	`total_amount` integer NOT NULL,
	`placed_at` integer NOT NULL,
	`cancelled_at` integer
);
--> statement-breakpoint
CREATE INDEX `example_orders_placed_at_idx` ON `example_orders` (`placed_at`);--> statement-breakpoint
CREATE TABLE `example_products` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`unit_price` integer NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "example_products_stock_non_negative" CHECK("example_products"."stock" >= 0)
);
