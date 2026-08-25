/**
 * authController.js — Xử lý xác thực người dùng Đa chi nhánh (1-Step Auth & Token Rotation)
 *
 * Export: { loginUser, refreshToken, logoutUser, switchBranch }
 */
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { getCentralModels, getBranchModels } = require("../db/branchConnectionManager");
const {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} = require("../utils/generateTokens");

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
  path: "/api/v1/auth",
};

// -----------------------------------------------------------------------
// POST /api/v1/auth/login (1-Step Multi-Branch Login)
// -----------------------------------------------------------------------
const loginUser = async (req, res) => {
  try {
    const { username, password, branchCode: reqBranchCode } = req.body;

    const centralModels = req.centralModels || (await getCentralModels());

    // 1. Tra cứu LoginIndex tại CSDL Trung tâm (cho nhân viên chi nhánh)
    const loginIndex = await centralModels.LoginIndex.findOne({ username });

    if (loginIndex) {
      // === LUỒNG 1: BRANCH USER (sale, pt, reception, om, sm, pm) ===
      const branchCode = loginIndex.branchCode;
      const branchModels = await getBranchModels(branchCode);

      const user = await branchModels.User.findOne({ username });
      if (!user) {
        return res.status(404).json({ message: "Không tìm thấy thông tin nhân viên tại chi nhánh." });
      }

      if (user.isActive === false) {
        return res.status(401).json({
          code: "USER_DEACTIVATED",
          message: "Tài khoản của bạn đã bị vô hiệu hóa / khóa.",
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Mật khẩu không đúng!" });
      }

      const accessToken = generateAccessToken(user._id, user.role, {
        branchCode,
        isCentral: false,
      });
      const refreshToken = generateRefreshToken(user._id, {
        branchCode,
        isCentral: false,
      });

      // Lưu Session vào Branch DB
      await branchModels.Session.create({
        userId: user._id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent: req.headers["user-agent"] || null,
        ipAddress: req.ip || null,
      });

      res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);

      return res.status(200).json({
        message: "Đăng nhập thành công",
        token: accessToken,
        user: {
          id: user._id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          branchCode,
          isCentral: false,
        },
      });
    }

    // === LUỒNG 2: CENTRAL USER (admin, accountant) ===
    const centralUser = await centralModels.CentralUser.findOne({ username });
    if (!centralUser) {
      return res.status(404).json({ message: "Tài khoản không tồn tại!" });
    }

    if (centralUser.isActive === false) {
      return res.status(401).json({
        code: "USER_DEACTIVATED",
        message: "Tài khoản quản trị đã bị vô hiệu hóa / khóa.",
      });
    }

    const isCentralMatch = await bcrypt.compare(password, centralUser.password);
    if (!isCentralMatch) {
      return res.status(400).json({ message: "Mật khẩu không đúng!" });
    }

    const allowedBranches = centralUser.allowedBranches || ["*"];
    const activeBranch =
      reqBranchCode ||
      (allowedBranches.includes("*") ? "HN01" : allowedBranches[0] || "HN01");

    const accessToken = generateAccessToken(centralUser._id, centralUser.role, {
      allowedBranches,
      activeBranch,
      isCentral: true,
    });
    const refreshToken = generateRefreshToken(centralUser._id, {
      isCentral: true,
      activeBranch,
    });

    // Lưu Session vào Central DB
    await centralModels.CentralSession.create({
      userId: centralUser._id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userAgent: req.headers["user-agent"] || null,
      ipAddress: req.ip || null,
    });

    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);

    return res.status(200).json({
      message: "Đăng nhập trung tâm thành công",
      token: accessToken,
      user: {
        id: centralUser._id,
        username: centralUser.username,
        fullName: centralUser.fullName,
        role: centralUser.role,
        allowedBranches,
        activeBranch,
        isCentral: true,
      },
    });

  } catch (error) {
    console.error("Lỗi login:", error);
    res.status(500).json({ message: "Lỗi Server: " + error.message });
  }
};

// -----------------------------------------------------------------------
// POST /api/v1/auth/refresh-token
// -----------------------------------------------------------------------
const refreshToken = async (req, res) => {
  const token = req.cookies?.refreshToken;

  if (!token) {
    return res.status(401).json({
      code: "NO_REFRESH_TOKEN",
      message: "Không tìm thấy phiên đăng nhập",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const centralModels = req.centralModels || (await getCentralModels());

    if (decoded.isCentral) {
      // 1. Central User Refresh
      const session = await centralModels.CentralSession.findOne({
        userId: decoded.id,
        tokenHash: hashToken(token),
      });

      if (!session) {
        console.warn(`[Security] Phát hiện Central Refresh Token tái sử dụng: ${decoded.id}`);
        await centralModels.CentralSession.deleteMany({ userId: decoded.id });
        return res.status(401).json({
          code: "REFRESH_TOKEN_REUSE",
          message: "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.",
        });
      }

      const user = await centralModels.CentralUser.findById(decoded.id);
      if (!user || user.isActive === false) {
        await centralModels.CentralSession.findByIdAndDelete(session._id);
        return res.status(401).json({ code: "USER_NOT_FOUND", message: "Tài khoản không hợp lệ" });
      }

      const activeBranch = decoded.activeBranch || "HN01";
      const newAccessToken = generateAccessToken(user._id, user.role, {
        allowedBranches: user.allowedBranches || ["*"],
        activeBranch,
        isCentral: true,
      });
      const newRefreshToken = generateRefreshToken(user._id, {
        isCentral: true,
        activeBranch,
      });

      await centralModels.CentralSession.findByIdAndUpdate(session._id, {
        tokenHash: hashToken(newRefreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent: req.headers["user-agent"] || session.userAgent,
      });

      res.cookie("refreshToken", newRefreshToken, REFRESH_COOKIE_OPTIONS);
      return res.json({ token: newAccessToken });

    } else {
      // 2. Branch User Refresh
      const branchCode = decoded.branchCode || "HN01";
      const branchModels = await getBranchModels(branchCode);

      const session = await branchModels.Session.findOne({
        userId: decoded.id,
        tokenHash: hashToken(token),
      });

      if (!session) {
        console.warn(`[Security] Phát hiện Branch Refresh Token tái sử dụng: ${decoded.id} tại ${branchCode}`);
        await branchModels.Session.deleteMany({ userId: decoded.id });
        return res.status(401).json({
          code: "REFRESH_TOKEN_REUSE",
          message: "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.",
        });
      }

      const user = await branchModels.User.findById(decoded.id);
      if (!user || user.isActive === false) {
        await branchModels.Session.findByIdAndDelete(session._id);
        return res.status(401).json({ code: "USER_NOT_FOUND", message: "Tài khoản nhân viên không hợp lệ" });
      }

      const newAccessToken = generateAccessToken(user._id, user.role, {
        branchCode,
        isCentral: false,
      });
      const newRefreshToken = generateRefreshToken(user._id, {
        branchCode,
        isCentral: false,
      });

      await branchModels.Session.findByIdAndUpdate(session._id, {
        tokenHash: hashToken(newRefreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent: req.headers["user-agent"] || session.userAgent,
      });

      res.cookie("refreshToken", newRefreshToken, REFRESH_COOKIE_OPTIONS);
      return res.json({ token: newAccessToken });
    }

  } catch (error) {
    return res.status(401).json({
      code: "REFRESH_TOKEN_EXPIRED",
      message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    });
  }
};

// -----------------------------------------------------------------------
// POST /api/v1/auth/switch-branch
// Chuyển chi nhánh làm việc cho tài khoản Central (admin / accountant)
// -----------------------------------------------------------------------
const switchBranch = async (req, res) => {
  try {
    const { branchCode } = req.body;

    if (!branchCode) {
      return res.status(400).json({ message: "Vui lòng chọn mã chi nhánh (branchCode)" });
    }

    if (!req.user || (!req.user.isCentral && req.user.role !== "admin" && req.user.role !== "accountant")) {
      return res.status(403).json({ message: "Chỉ tài khoản quản trị Trung tâm mới có quyền chuyển chi nhánh" });
    }

    const normalizedCode = branchCode.trim().toUpperCase();
    const centralModels = req.centralModels || (await getCentralModels());

    // Xác thực chi nhánh có tồn tại trong hệ thống không
    const branch = await centralModels.Branch.findOne({ code: normalizedCode, isActive: true });
    if (!branch) {
      return res.status(404).json({ message: `Chi nhánh ${normalizedCode} không tồn tại hoặc đã ngừng hoạt động` });
    }

    // Kiểm tra quyền truy cập chi nhánh của user
    const allowedBranches = req.user.allowedBranches || ["*"];
    if (!allowedBranches.includes("*") && !allowedBranches.includes(normalizedCode)) {
      return res.status(403).json({ message: `Bạn không có quyền truy cập chi nhánh ${normalizedCode}` });
    }

    // Cấp lại Access Token mới với activeBranch đã thay đổi
    const newAccessToken = generateAccessToken(req.user._id, req.user.role, {
      allowedBranches,
      activeBranch: normalizedCode,
      isCentral: true,
    });

    return res.json({
      success: true,
      message: `Đã chuyển sang chi nhánh ${branch.name} (${normalizedCode})`,
      token: newAccessToken,
      activeBranch: normalizedCode,
      branchName: branch.name,
    });

  } catch (error) {
    console.error("Lỗi switch-branch:", error);
    res.status(500).json({ message: "Lỗi Server: " + error.message });
  }
};

// -----------------------------------------------------------------------
// POST /api/v1/auth/logout
// -----------------------------------------------------------------------
const logoutUser = async (req, res) => {
  const token = req.cookies?.refreshToken;

  if (token) {
    try {
      if (req.user && req.user.isCentral) {
        const centralModels = req.centralModels || (await getCentralModels());
        await centralModels.CentralSession.deleteOne({
          userId: req.user._id,
          tokenHash: hashToken(token),
        });
      } else if (req.user && req.models) {
        await req.models.Session.deleteOne({
          userId: req.user._id,
          tokenHash: hashToken(token),
        });
      }
    } catch (e) {
      // Bỏ qua lỗi xóa session
    }
  }

  res.clearCookie("refreshToken", { path: "/api/v1/auth" });
  res.json({ message: "Đã đăng xuất thành công" });
};

module.exports = { loginUser, refreshToken, switchBranch, logoutUser };