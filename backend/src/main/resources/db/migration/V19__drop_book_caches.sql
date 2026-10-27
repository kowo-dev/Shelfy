delete from discover_cache where category = 'book' or category like 'book:%';

delete from provider_cache where namespace in ('openlibrary-book', 'search-openlibrary');
