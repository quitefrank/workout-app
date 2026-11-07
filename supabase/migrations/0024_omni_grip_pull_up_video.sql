-- The demo video Frank's Notion row carried before migration 0021 removed it, on the row that came back in 0023.
update exercises set video_url = coalesce(video_url, 'https://youtu.be/C47fKaggsJY') where slug = 'omni-grip-pull-up';
