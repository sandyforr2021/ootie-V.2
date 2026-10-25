# City name lookup

Source: [GeoNames cities15000](https://download.geonames.org/export/dump/cities15000.zip)
and [administrative region names](https://download.geonames.org/export/dump/admin1CodesASCII.txt),
retrieved 2026-10-25. Attribution: GeoNames, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The index covers cities over 15,000 inhabitants and administrative seats, with
their alternative names in many languages. Exact names are matched independently
of the interface language. Same-name cities remain separate choices; results are
ordered by population. Smaller places and qualified queries use Photon/OSM.
This is a reference dataset, not a guarantee that every world locality or spelling
is included. Geographic coordinates are used only to request weather forecasts.

Rebuild with `python scripts/build-weather-city-index.py cities15000.txt admin1CodesASCII.txt`.
The SHA-256 prefix selects one compressed shard, and the server caches at most
eight decoded shards to limit memory use. Do not add these files to the browser bundle.
