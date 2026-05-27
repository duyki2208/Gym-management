const nodemailer = require('nodemailer');
const { format } = require('date-fns');

// Configure transporter
const transporter = nodemailer.createTransport({
  service: 'gmail', // You can change this to another provider if needed
  auth: {
    user: process.env.EMAIL_USER, // Set in .env
    pass: process.env.EMAIL_PASS  // Set in .env (App Password for Gmail)
  }
});

transporter.verify(function(error, success) {
  if (error) {
    console.error("Lỗi cấu hình Email Transporter:", error);
  } else {
    console.log("Email Transporter Ready to send messages!");
  }
});

// Template for new registration
const sendRegistrationEmail = async (email, name, packageType, startDate, endDate, price, staffName) => {
  if (!email) return;
  
  const formattedStartDate = format(new Date(startDate), "dd/MM/yyyy");
  const formattedEndDate = format(new Date(endDate), "dd/MM/yyyy");
  const formattedPrice = Number(price || 0).toLocaleString("vi-VN");

  const mailOptions = {
    from: `"Gym Fitness" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `[Gym Fitness] Xác nhận đăng ký thành công gói tập - Chào mừng ${name}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background-color: #f4f7f6; border-radius: 12px; overflow: hidden; border: 1px solid #dde2df;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #13ec80 0%, #0abf69 100%); padding: 32px 24px; text-align: center;">
          <h1 style="color: #fff; margin: 0 0 6px 0; font-size: 22px; letter-spacing: 0.5px;">GYM FITNESS</h1>
          <p style="color: #d4fbe9; margin: 0; font-size: 14px;">Cảm ơn bạn đã lựa chọn Gym Fitness!</p>
        </div>

        <!-- Body -->
        <div style="padding: 28px 28px 20px; background-color: #ffffff;">
          <p style="color: #333; margin: 0 0 10px 0;">Xin chào <strong style="color: #0abf69;">${name}</strong>,</p>
          <p style="color: #555; line-height: 1.7; margin: 0 0 20px 0;">
            Chúc mừng bạn đã đăng ký thành công gói tập tại hệ thống của chúng tôi. 
            Chúng tôi rất hào hứng được đồng hành cùng bạn trên hành trình chinh phục vóc dáng và sức khỏe!
          </p>
          <p style="color: #333; font-weight: 600; margin: 0 0 12px 0;">Dưới đây là thông tin chi tiết về gói tập của bạn:</p>

          <!-- Info Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">
            <thead>
              <tr style="background-color: #0abf69;">
                <th style="padding: 11px 16px; text-align: left; color: #fff; font-size: 14px; font-weight: 600; width: 45%;">Thông tin chi tiết</th>
                <th style="padding: 11px 16px; text-align: left; color: #fff; font-size: 14px; font-weight: 600;">Nội dung</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background-color: #f9fffe;">
                <td style="padding: 10px 16px; color: #555; font-size: 14px; border-bottom: 1px solid #e8f5f0;">Khách hàng</td>
                <td style="padding: 10px 16px; color: #222; font-size: 14px; font-weight: 600; border-bottom: 1px solid #e8f5f0;">${name}</td>
              </tr>
              <tr style="background-color: #ffffff;">
                <td style="padding: 10px 16px; color: #555; font-size: 14px; border-bottom: 1px solid #e8f5f0;">Gói tập</td>
                <td style="padding: 10px 16px; color: #222; font-size: 14px; font-weight: 600; border-bottom: 1px solid #e8f5f0;">${packageType}</td>
              </tr>
              <tr style="background-color: #f9fffe;">
                <td style="padding: 10px 16px; color: #555; font-size: 14px; border-bottom: 1px solid #e8f5f0;">Giá trị gói</td>
                <td style="padding: 10px 16px; color: #0abf69; font-size: 14px; font-weight: 700; border-bottom: 1px solid #e8f5f0;">${formattedPrice} VNĐ</td>
              </tr>
              <tr style="background-color: #ffffff;">
                <td style="padding: 10px 16px; color: #555; font-size: 14px; border-bottom: 1px solid #e8f5f0;">Ngày bắt đầu</td>
                <td style="padding: 10px 16px; color: #222; font-size: 14px; font-weight: 600; border-bottom: 1px solid #e8f5f0;">${formattedStartDate}</td>
              </tr>
              <tr style="background-color: #f9fffe;">
                <td style="padding: 10px 16px; color: #555; font-size: 14px;">Ngày hết hạn</td>
                <td style="padding: 10px 16px; color: #e53e3e; font-size: 14px; font-weight: 700;">${formattedEndDate}</td>
              </tr>
            </tbody>
          </table>

          <!-- Notes -->
          <div style="background-color: #fffbea; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 14px 18px; margin-bottom: 20px;">
            <p style="margin: 0 0 8px 0; font-weight: 700; color: #b45309; font-size: 14px;">Lưu ý nhỏ dành cho bạn:</p>
            <ul style="margin: 0; padding-left: 18px; color: #555; font-size: 14px; line-height: 1.8;">
              <li>Vui lòng đến quầy lễ tân để đăng ký nhận diện gương mặt và được hướng dẫn sử dụng trang thiết bị nếu đây là lần đầu bạn tham gia.</li>
              <li>Đội ngũ huấn luyện viên${staffName ? ` (bao gồm tư vấn viên <strong>${staffName}</strong>)` : ''} luôn sẵn sàng hỗ trợ bạn.</li>
            </ul>
          </div>

          <p style="color: #555; line-height: 1.7; margin: 0 0 16px 0;">
            Chúc bạn có những giờ phút tập luyện hiệu quả và tràn đầy năng lượng!
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f0faf4; padding: 18px 28px; border-top: 1px solid #dde2df; text-align: center;">
          <p style="margin: 0; color: #555; font-size: 13px;">Trân trọng,</p>
          <p style="margin: 4px 0 0 0; font-weight: 700; color: #0abf69; font-size: 14px;">Đội ngũ Gym Fitness</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Registration email sent: " + info.response);
  } catch (error) {
    console.error("Error sending registration email: ", error);
  }
};

// Template for expiration reminder (14 days)
const sendExpirationReminderEmail = async (email, name, packageType, endDate) => {
  if (!email) return;

  const formattedEndDate = format(new Date(endDate), "dd/MM/yyyy");

  const mailOptions = {
    from: `"Gym Fitness" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Nhắc nhở: Gói tập của bạn sắp hết hạn - Gym Fitness",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #ffbb28; padding: 20px; text-align: center;">
          <h2 style="color: #fff; margin: 0;">Thông Báo Gói Tập Sắp Hết Hạn</h2>
        </div>
        <div style="padding: 20px; color: #333;">
          <p>Xin chào <strong>${name}</strong>,</p>
          <p>Gym Fitness xin thông báo gói tập <strong>${packageType}</strong> của bạn sẽ hết hạn sau <strong>14 ngày</strong> nữa.</p>
          
          <div style="background-color: #fef9e7; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <p style="margin: 5px 0;"><strong>Ngày hết hạn chính thức:</strong> <span style="color: #d97706; font-weight: bold;">${formattedEndDate}</span></p>
          </div>
          
          <p>Để không làm gián đoạn quá trình tập luyện, bạn vui lòng liên hệ quầy lễ tân hoặc phản hồi lại email này để được tư vấn và hỗ trợ gia hạn gói tập sớm nhất.</p>
          <p>Cảm ơn bạn đã luôn đồng hành cùng Gym Fitness!</p>
          <br>
          <p>Trân trọng,<br><strong>Đội ngũ Gym Fitness</strong></p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Expiration reminder email sent: " + info.response);
  } catch (error) {
    console.error("Error sending expiration reminder email: ", error);
  }
};

// Template for unfreeze notification
const sendUnfreezeNotificationEmail = async (email, name, packageType, newEndDate, actualUnfreezeDate = new Date()) => {
  if (!email) return;

  const formattedUnfreezeDate = format(new Date(actualUnfreezeDate), "dd/MM/yyyy");
  const formattedEndDate = format(new Date(newEndDate), "dd/MM/yyyy");

  const mailOptions = {
    from: `"Gym Fitness" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `[Gym Fitness] Thông báo: Gói tập của bạn đã được kích hoạt lại!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #0abf69; padding: 20px; text-align: center;">
          <h2 style="color: #fff; margin: 0;">Thông Báo Kích Hoạt Lại Gói Tập</h2>
        </div>
        <div style="padding: 20px; color: #333;">
          <p>Xin chào <strong>${name}</strong>,</p>
          <p>Gym Fitness xin thông báo gói tập <strong>${packageType}</strong> của bạn đã được kích hoạt lại (kết thúc thời gian bảo lưu).</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tbody>
              <tr style="background-color: #f9f9f9;">
                <td style="padding: 10px; border-bottom: 1px solid #eee;">Ngày kích hoạt lại:</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">${formattedUnfreezeDate}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">Ngày hết hạn mới:</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #e53e3e;">${formattedEndDate}</td>
              </tr>
            </tbody>
          </table>
          
          <p>Chúc bạn có những giờ phút tập luyện tràn đầy năng lượng và đạt hiệu quả tốt nhất!</p>
          <br>
          <p>Trân trọng,<br><strong>Đội ngũ Gym Fitness</strong></p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Unfreeze notification email sent: " + info.response);
  } catch (error) {
    console.error("Error sending unfreeze notification email: ", error);
  }
};

module.exports = {
  sendRegistrationEmail,
  sendExpirationReminderEmail,
  sendUnfreezeNotificationEmail
};
