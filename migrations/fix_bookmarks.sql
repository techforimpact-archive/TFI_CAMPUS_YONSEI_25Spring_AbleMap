
-- 북마크 테이블 다시 생성
DROP TABLE IF EXISTS bookmarks CASCADE;

CREATE TABLE bookmarks (
  id SERIAL PRIMARY KEY,
  poi_id TEXT NOT NULL UNIQUE,
  place_name TEXT NOT NULL,
  usernames TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_bookmarks_poi_id ON bookmarks(poi_id);
CREATE INDEX idx_bookmarks_usernames ON bookmarks USING GIN(usernames);

-- 테이블 생성 확인
SELECT table_name, column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'bookmarks' 
ORDER BY ordinal_position;
