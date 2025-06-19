
-- 기존 북마크 테이블 삭제 (데이터 손실 주의)
DROP TABLE IF EXISTS bookmarks;

-- 새로운 북마크 테이블 생성
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

-- 사용자 테이블의 bookmarked_place_ids 필드 초기화 (요청사항)
UPDATE users SET bookmarked_place_ids = '{}' WHERE bookmarked_place_ids IS NOT NULL;
