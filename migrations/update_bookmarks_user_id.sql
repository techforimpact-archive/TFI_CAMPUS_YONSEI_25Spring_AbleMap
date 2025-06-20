
-- 기존 북마크 테이블 삭제
DROP TABLE IF EXISTS bookmarks CASCADE;

-- 새로운 북마크 테이블 생성 (user_id 배열 기반)
CREATE TABLE bookmarks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER[] NOT NULL DEFAULT '{}',
  place_id TEXT NOT NULL UNIQUE,
  place_name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_bookmarks_place_id ON bookmarks(place_id);
CREATE INDEX idx_bookmarks_user_id ON bookmarks USING GIN(user_id);

-- 테이블 생성 확인
SELECT table_name, column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'bookmarks'
ORDER BY ordinal_position;
