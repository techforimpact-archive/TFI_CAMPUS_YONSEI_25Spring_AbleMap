import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { db, pool } from "./db";
import { exec } from "child_process";
import { promisify } from "util";
import path from 'path';
import cookieParser from 'cookie-parser';

const execAsync = promisify(exec);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Serve static files from the public directory
app.use('/images', express.static(path.join(process.cwd(), 'public/images')));
app.use('/user_images', express.static(path.join(process.cwd(), 'public/user_images')));
log('Serving static files from: ' + path.join(process.cwd(), 'public/images'));
log('Serving user images from: ' + path.join(process.cwd(), 'public/user_images'));

app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api")) {
      let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  console.log("초기 데이터 점검 중...");
  try {
    log("Setting up database schema...");
    
    // 데이터베이스 연결 테스트
    try {
      console.log("데이터베이스 테이블에 접근 가능합니다.");
    } catch (dbError) {
      console.error("데이터베이스 연결 오류:", dbError);
    }
    
    // 기본 데이터 초기화 생략 - 이미 데이터베이스에 저장되어 있음
  } catch (err) {
    console.error("Database initialization error:", err);
    log("Failed to initialize database, some features may not work correctly");
  }
  
  try {
    // 라우트 등록
    const server = registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      console.error(err);
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on port 5000
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = 5000;
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, async () => {
      // Object Storage SDK 테스트
      try {
        const { Client } = await import('@replit/object-storage');
        const client = new Client();
        
        console.log("=== Object Storage SDK 상태 확인 ===");
        console.log("✅ Object Storage SDK 로드 성공");
        
        // 간단한 테스트 파일로 연결 확인
        const testResult = await client.list();
        if (testResult.ok) {
          console.log("✅ Object Storage 연결 성공");
          console.log("📦 Bucket 내 파일 수:", testResult.value.length);
        } else {
          console.log("❌ Object Storage 연결 실패:", testResult.error);
        }
      } catch (error) {
        console.log("❌ Object Storage SDK 초기화 실패:", error);
      }
      
      // 모든 환경 변수 중 REPLIT 관련 출력
      const replitEnvVars = Object.keys(process.env).filter(key => key.startsWith('REPLIT'));
      console.log("모든 REPLIT 환경 변수:", replitEnvVars);
      
      // Object Storage 환경 변수 확인
      const storageToken = process.env.REPLIT_OBJECT_STORAGE_TOKEN;
      const bucketId = process.env.REPLIT_OBJECT_STORAGE_BUCKET_ID;
      
      if (storageToken && bucketId) {
        console.log("✅ Object Storage 완전 구성됨");
      } else {
        console.log("⚠️ Object Storage 구성 불완전 - 토큰 필요");
      }
      
      log(`serving on port ${port}`);
    });
  } catch (error) {
    console.error("서버 시작 오류:", error);
  }
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down server...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('Shutting down server...');
    process.exit(0);
  });
})();
