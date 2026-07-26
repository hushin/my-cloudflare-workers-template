-- 商品マスタの初期データ。注文 API を手で叩けるようにするための seed。
-- migration の再適用でも落ちないよう INSERT OR IGNORE にしておく。
INSERT OR IGNORE INTO `example_products` (`code`, `name`, `unit_price`, `stock`) VALUES
	('WIDGET-A', 'Widget A', 1200, 50),
	('WIDGET-B', 'Widget B', 3400, 10),
	('GADGET-C', 'Gadget C', 980, 0);
