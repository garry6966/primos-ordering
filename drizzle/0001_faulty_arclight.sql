CREATE TABLE `menu_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`description` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `menu_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `menu_categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`price` decimal(6,2) NOT NULL,
	`available` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `menu_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNumber` varchar(20) NOT NULL,
	`customerName` varchar(200) NOT NULL,
	`customerPhone` varchar(30) NOT NULL,
	`customerEmail` varchar(320),
	`orderType` enum('delivery','collection') NOT NULL,
	`deliveryAddress` text,
	`deliveryFee` decimal(5,2) NOT NULL DEFAULT '0.00',
	`subtotal` decimal(8,2) NOT NULL,
	`total` decimal(8,2) NOT NULL,
	`status` enum('new','preparing','ready','delivered','collected') NOT NULL DEFAULT 'new',
	`items` json NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_orderNumber_unique` UNIQUE(`orderNumber`)
);
--> statement-breakpoint
CREATE TABLE `pizza_toppings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`price` decimal(5,2) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `pizza_toppings_id` PRIMARY KEY(`id`)
);
