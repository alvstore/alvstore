UPDATE public.apple_products SET category = 'iPhone' WHERE LOWER(TRIM(category)) = 'iphone';
UPDATE public.apple_products SET category = 'Mac' WHERE LOWER(TRIM(category)) IN ('mac', 'macbook', 'macbook pro', 'macbook air', 'imac');
UPDATE public.apple_products SET category = 'iPad' WHERE LOWER(TRIM(category)) = 'ipad';
UPDATE public.apple_products SET category = 'Watch' WHERE LOWER(TRIM(category)) = 'watch';
UPDATE public.apple_products SET category = 'AirPods' WHERE LOWER(TRIM(category)) = 'airpods';
UPDATE public.apple_products SET category = 'HomePod' WHERE LOWER(TRIM(category)) = 'homepod';
UPDATE public.apple_products SET category = 'Beats' WHERE LOWER(TRIM(category)) = 'beats';
UPDATE public.apple_products SET category = 'Accessories' WHERE LOWER(TRIM(category)) = 'accessories';
UPDATE public.apple_products SET category = 'AppleCare' WHERE LOWER(TRIM(category)) = 'applecare';