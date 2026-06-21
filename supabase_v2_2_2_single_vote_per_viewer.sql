-- Planète Stream V2.2.2
-- Optionnel : nettoie les anciennes critiques principales en double
-- et empêche qu'un même viewer vote plusieurs fois pour le même film.

with ranked_comments as (
  select
    id,
    row_number() over (
      partition by movie_id, viewer_uuid
      order by coalesce(edited_at, created_at) desc, created_at desc
    ) as rn
  from comments
  where parent_id is null
    and viewer_uuid is not null
)
delete from comments
where id in (
  select id
  from ranked_comments
  where rn > 1
);

create unique index if not exists comments_one_main_review_per_viewer
on comments(movie_id, viewer_uuid)
where parent_id is null and viewer_uuid is not null;
