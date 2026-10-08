# EventLucky

> Onchain lucky draw platform -- tổ chức event tặng thưởng USDC minh bạch trên Arc Network.

[![Arc Testnet](https://img.shields.io/badge/Arc-Testnet-blue)](https://explorer.testnet.arc.io/address/0xA25c61442788862132d5f5c91CAF742FEd622051)
[![Contract](https://img.shields.io/badge/Contract-Verified-green)](https://explorer.testnet.arc.io/address/0xA25c61442788862132d5f5c91CAF742FEd622051)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## Mô tả

**EventLucky** giúp các tài khoản mạng xã hội (X/Twitter, Telegram...) tổ chức event tri ân cộng đồng một cách minh bạch và an toàn. Host tạo event, người chơi đoán số, quay số random onchain -- người thắng nhận USDC trực tiếp vào ví, không cần biết crypto.

---

## Demo

- **Contract (Arc Testnet):** [`0xA25c61442788862132d5f5c91CAF742FEd622051`](https://explorer.testnet.arc.io/address/0xA25c61442788862132d5f5c91CAF742FEd622051)
- **USDC (Arc Testnet):** `0x3600000000000000000000000000000000000000`

---

## Tính năng

- **Onchain & minh bạch** -- USDC lock vào smart contract từ đầu, host không bùng được
- **Commit-reveal randomness** -- kết quả quay số không thể bị can thiệp
- **Multi-prize** -- 1 nhất / 2 nhì / 3 ba, chia 6:4 nếu 2 người cùng đoán đúng
- **Zero-crypto UX** -- người nhận chỉ cần email, không cần MetaMask hay seed phrase
- **Email notification** -- chỉ người thắng nhận mail, trong vòng 120 phút
- **Link xác nhận 1 lần** -- hết hạn 48h, tiền hoàn host nếu không nhận
- **Bilingual** -- hỗ trợ Tiếng Việt và English

---

## Flow hoạt động

```
Host tạo event → lock USDC vào contract
     ↓
Chia sẻ link event lên X/Twitter
     ↓
Người chơi đăng nhập (Google/Email) → chọn số dự đoán
     ↓
Host commit secret (trước deadline) → reveal để quay số
     ↓
App gửi mail cho người thắng (trong 120 phút)
     ↓
Người thắng click link trong mail → xác nhận → USDC về ví
     ↓
Nếu không xác nhận trong 48h → USDC hoàn về host
```

---

## 2 loại người dùng

| | Host | Người chơi |
|---|---|---|
| Ví | MetaMask / ConnectKit | Circle social wallet (Google/Email) |
| Việc làm | Tạo event, nạp USDC, quay số | Đăng ký số, chờ mail, nhận thưởng |
| Cần biết crypto? | Cơ bản | Không cần |

---

## Bảo mật

- USDC lock onchain từ lúc tạo -- host không rút được trước khi event kết thúc
- Mail thông báo từ domain cố định của app, không qua DM
- Link xác nhận 1 lần dùng, hết hạn 48h
- App không bao giờ hỏi seed phrase hay private key
- Nếu host không quay số trong 72h -- bất kỳ ai cũng có thể cancel, tiền hoàn host

---

## Tech Stack

| Layer | Công nghệ |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS (Vite) |
| Smart Contract | Solidity 0.8.28 (OpenZeppelin, commit-reveal RNG) |
| Blockchain | Arc Testnet -- USDC là native gas token |
| Wallet (host) | MetaMask / ConnectKit / wagmi |
| Email | Resend (3,000 email/tháng free) |
| Backend | Bun server (email notifications) |

---

## Cài đặt & Chạy local

### Yêu cầu

- [Bun](https://bun.sh) >= 1.0
- [Foundry](https://getfoundry.sh) (để build/deploy contract)
- Node.js >= 18

### Bước 1 -- Clone và cài dependencies

```bash
git clone https://github.com/YOUR_USERNAME/eventlucky.git
cd eventlucky
bun install
```

### Bước 2 -- Tạo file `.env`

```bash
cp .env.example .env
```

Điền vào `.env`:

```env
VITE_CONTRACT_ADDRESS=0xA25c61442788862132d5f5c91CAF742FEd622051
RESEND_API_KEY=re_xxxxxxxxxxxx
```

### Bước 3 -- Chạy app

```bash
# Terminal 1: Frontend
bun run dev

# Terminal 2: Backend (email server)
bun run server
```

Mở trình duyệt: `http://localhost:5173`

---

## Deploy Contract

Contract đã được deploy trên Arc Testnet. Nếu muốn deploy lại:

```bash
forge script contracts/script/DeployEventLucky.s.sol:DeployEventLucky \
  --rpc-url https://rpc.testnet.arc.io \
  --private-key YOUR_PRIVATE_KEY \
  --broadcast
```

---

## Deploy Frontend lên Vercel

1. Push code lên GitHub
2. Vào [vercel.com](https://vercel.com) → New Project → chọn repo
3. Thêm Environment Variables:
   - `VITE_CONTRACT_ADDRESS` = địa chỉ contract
   - `RESEND_API_KEY` = API key từ resend.com
4. Deploy

> **Lưu ý:** Backend email server cần chạy riêng (không phải serverless). Vercel chỉ host được phần frontend.

---

## Cấu trúc thư mục

```
eventlucky/
├── contracts/
│   ├── EventLucky.sol          # Smart contract chính
│   └── script/
│       └── DeployEventLucky.s.sol
├── src/
│   ├── components/
│   │   ├── HomeView.tsx        # Trang chủ
│   │   ├── CreateEventView.tsx # Tạo event
│   │   ├── EventView.tsx       # Xem event + đăng ký + host panel
│   │   └── LangSwitcher.tsx    # Toggle VI/EN
│   ├── i18n.ts                 # Translations (vi/en)
│   ├── LanguageContext.tsx     # Language context
│   └── abi.ts                  # Contract ABI
├── server/
│   └── index.ts                # Email notification server
├── vercel.json
└── README.md
```

---

## Giấy phép

MIT © 2026 -- Built with [Arc Studio](https://studio.arc.io)
