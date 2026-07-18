-- Guess the Song — seed data
-- One curated playlist with 10 tracks so the game is playable end-to-end.
-- provider_ref values are YouTube video IDs. answer_aliases are lowercase
-- alternates the host can accept when judging.

with pl as (
  insert into playlists (name, description, theme, is_predefined)
  values (
    'Clásicos Imprescindibles',
    'Himnos que todos han escuchado alguna vez.',
    'classics',
    true
  )
  returning id
)
insert into tracks
  (playlist_id, provider, provider_ref, answer_title, answer_artist, answer_aliases, year, default_start_ms)
select
  pl.id, 'youtube', v.provider_ref, v.title, v.artist, v.aliases, v.year, v.start_ms
from pl,
  (values
    ('fJ9rUzIMcZQ', 'Bohemian Rhapsody',      'Queen',            array['bohemian rhapsody','bohemian'],        1975, 55000),
    ('djV11Xbc914', 'Take On Me',              'a-ha',             array['take on me'],                          1985, 40000),
    ('dQw4w9WgXcQ', 'Never Gonna Give You Up', 'Rick Astley',      array['never gonna give you up'],             1987, 43000),
    ('hTWKbfoikeg', 'Smells Like Teen Spirit', 'Nirvana',          array['smells like teen spirit','teen spirit'], 1991, 30000),
    ('Zi_XLOBDo_Y', 'Billie Jean',             'Michael Jackson',  array['billie jean'],                         1983, 30000),
    ('btPJPFnesV4', 'Eye of the Tiger',        'Survivor',         array['eye of the tiger'],                    1982, 48000),
    ('FTQbiNvZqaY', 'Africa',                  'Toto',             array['africa'],                              1982, 60000),
    ('1w7OgIMMRc4', 'Sweet Child o'' Mine',    'Guns N'' Roses',   array['sweet child o mine','sweet child of mine'], 1987, 50000),
    ('gGdGFtwCNBE', 'Mr. Brightside',          'The Killers',      array['mr brightside','mister brightside'],   2003, 22000),
    ('1k8craCGpgs', 'Don''t Stop Believin''',  'Journey',          array['dont stop believin','don''t stop believing'], 1981, 50000)
  ) as v(provider_ref, title, artist, aliases, year, start_ms);
