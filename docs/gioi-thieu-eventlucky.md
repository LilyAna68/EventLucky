# EventLucky — Giveaway onchain, minh bạch từ đầu đến cuối

---

Bạn có bao giờ thấy một host trên X đăng kiểu:

> *"Tặng 50 USDC cho ai đoán đúng con số hôm nay. Comment số của bạn bên dưới. Mình sẽ quay số lúc 9 giờ tối."*

Rồi đến 9 giờ tối... im lặng. Hoặc một tài khoản lạ hoắc "thắng". Hoặc host biến mất.

Không phải host nào cũng xấu. Nhưng hệ thống đang khiến người tốt cũng trông có vẻ đáng ngờ — vì không có gì để verify cả.

**EventLucky sinh ra để fix đúng cái đó.**

---

## Chuyện bắt đầu từ đâu

Tôi đang build trên Arc — một blockchain mà USDC chính là native gas, không cần ETH, không cần token lạ, phí giao dịch dưới 0.05 USDC, xác nhận dưới 1 giây.

Lý tưởng để làm app thanh toán nhỏ. Và giveaway chính là use case hoàn hảo — host cần lock tiền trước, người nhận cần claim sau, tất cả đều minh bạch.

Vậy là tôi build EventLucky trong một buổi tối.

---

## App này làm gì?

Nói ngắn gọn: **Host tạo event giveaway onchain. Người chơi đăng ký số. Quay số random minh bạch. Người thắng nhận USDC qua email — không cần biết crypto.**

### Flow thực tế

**Phía host:**

1. Kết nối ví, vào app, nhấn *Tạo Event*
2. Điền tên event, range số (ví dụ 1–100), deadline đăng ký
3. Cấu hình giải: Giải nhất 20 USDC, Giải nhì 10 USDC...
4. Approve và lock USDC vào smart contract — **tiền nằm trong contract, không phải trong ví host**
5. Copy link event, post lên X
6. Trước deadline: **commit một secret** (chuỗi bất kỳ bạn tự đặt)
7. Sau deadline: **reveal secret** để quay số — kết quả tính từ secret + block hash, không ai can thiệp được
8. Xong. App tự lo phần còn lại.

**Phía người chơi:**

1. Click link event từ X
2. Đăng nhập bằng Google hoặc Email — ví tự tạo ngầm, không cần seed phrase
3. Chọn số, nhập email, nhấn Đăng ký
4. Chờ kết quả

**Nếu thắng:**

1. Nhận email từ app (không phải từ host, không phải DM)
2. Click link xác nhận trong email
3. Nhấn *Nhận thưởng* — USDC vào ví ngay
4. Muốn chuyển đi đâu cũng được

---

## Tại sao lại đáng tin hơn giveaway thông thường?

Đây là câu hỏi quan trọng nhất.

**USDC bị lock từ đầu.** Khi host tạo event, toàn bộ giải thưởng đã nằm trong smart contract. Host không rút được. Không bùng được. Contract giữ.

**Quay số onchain.** Kết quả được tính từ secret của host + block hash tại thời điểm reveal — hai thứ không ai kiểm soát được cùng lúc. Ai cũng verify được trên explorer.

**Không có Gift Link qua DM.** Một trong những lỗ hổng scam phổ biến nhất là giả mạo host gửi DM "bạn thắng rồi, click link này". EventLucky không dùng DM — người thắng nhận email từ domain cố định của app, link dùng một lần, hết hạn 48 giờ.

**Hết 48 giờ không nhận thì sao?** USDC hoàn về host tự động. Không có tiền kẹt mãi mãi.

---

## Thử ngay — không cần chuẩn bị gì cả

App đang chạy live trên Arc Testnet. USDC testnet miễn phí, không rủi ro thật.

**Link app:** [event-lucky-kohl.vercel.app](https://event-lucky-kohl.vercel.app)

**Thử làm host:**

- Kết nối MetaMask (chuyển sang Arc Testnet)
- Lấy USDC testnet miễn phí tại *Get test USDC* trong Arc Studio sidebar
- Tạo một event nhỏ, commit secret, quay số

**Thử làm người chơi:**

- Đăng nhập bằng Google
- Vào link event, chọn số, đăng ký
- Xem flow nhận thưởng hoạt động thế nào

---

## Mã nguồn

Toàn bộ code mở: [github.com/LilyAna68/EventLucky](https://github.com/LilyAna68/EventLucky)

Smart contract đã deploy tại:
`0xA25c61442788862132d5f5c91CAF742FEd622051` trên Arc Testnet

[Xem trên explorer](https://explorer.testnet.arc.io/address/0xA25c61442788862132d5f5c91CAF742FEd622051)

---

## Stack

- **Frontend:** React + TypeScript + Tailwind + Vite
- **Blockchain:** Arc Testnet — USDC là native gas, phí cố định, finality dưới 1 giây
- **Smart contract:** Solidity với commit-reveal randomness, reentrancy guard, multi-prize distribution
- **Wallet:** ConnectKit (host) + Circle social wallet (người chơi — đăng nhập Google/Email)
- **Email:** Resend
- **Deploy:** Vercel (frontend) + Foundry (contract)

---

## Một vài điều tôi học được khi build

**Commit-reveal randomness quan trọng hơn tôi nghĩ.**
Ban đầu tôi dùng `block.prevrandao` cho random — hóa ra trên Arc nó luôn bằng 0. Phải chuyển sang commit-reveal: host commit hash của secret trước, reveal sau. Kết hợp với block hash tại thời điểm reveal thì host không thể chọn block có lợi.

**Gas limit là vấn đề thật.**
Nếu không giới hạn số người đăng ký, ai đó có thể spam đủ entries để `draw()` vượt block gas limit — tiền kẹt mãi mãi. Giải pháp: cap 500 người, và dùng O(n) single-pass thay vì O(n²) sort.

**Liveness quan trọng không kém security.**
Nếu host biến mất sau khi nhận tiền đăng ký (dù là testnet), tiền vẫn phải có đường ra. Hàm `cancelDraw` cho phép bất kỳ ai gọi sau 72 giờ để hoàn tiền về host — không cần permission, chỉ cần đủ thời gian.

---

## Feedback

App này còn ở giai đoạn testnet. Tôi muốn nghe:

- Bạn thấy flow nào khó hiểu?
- Bạn muốn thêm tính năng gì?
- Có bug nào bạn tìm được không?

Drop issue trên GitHub hoặc tag tôi trên X.

---

*Built with Arc Studio. Mọi giao dịch đều onchain, mọi kết quả đều verify được.*
