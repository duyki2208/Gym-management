# Antigravity Specific Rules

This file overrides or supplements `AGENTS.md` specifically for the Antigravity agent.

## Communication Preferences
- **Language:** Mặc định sử dụng Tiếng Việt trong giao tiếp với người dùng, giải thích code và comment.
- **Code naming:** Sử dụng Tiếng Anh cho tên biến, tên hàm, tên class và schema database.

## Output Formatting
- Sử dụng các alert của GitHub Flavored Markdown (như `> [!IMPORTANT]`, `> [!NOTE]`) để làm nổi bật các phần cấu hình, lưu ý hoặc thay đổi breaking.
- Khi tạo artifact, luôn để `request_feedback=true` nếu liên quan đến các quyết định kiến trúc hoặc thay đổi lớn (như thêm package npm mới hoặc đổi logic database).

## Tool Usage
- Trước khi thực hiện thay đổi trên nhiều file, hãy sử dụng công cụ `grep_search` để đảm bảo không làm vỡ các module liên quan.
- Sau khi viết mã mới ở Frontend, hãy cố gắng tự start server bằng script `npm run dev` để kiểm tra lỗi cú pháp (Syntax error).
