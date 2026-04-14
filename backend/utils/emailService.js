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
const sendRegistrationEmail = async (email, name, packageType, endDate, price) => {
  if (!email) return;
  
  const formattedEndDate = format(new Date(endDate), "dd/MM/yyyy");
  const formattedPrice = price.toLocaleString("vi-VN") + " VNĐ";

  const mailOptions = {
    from: `"Gym Fitness" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Xác nhận đăng ký gói tập thành công - Gym Fitness",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #13ec80; padding: 20px; text-align: center;">
          <h2 style="color: #182c22; margin: 0;">Cảm ơn bạn đã lựa chọn Gym Fitness!</h2>
        </div>
        <div style="padding: 20px; color: #333;">
          <p>Xin chào <strong>${name}</strong>,</p>
          <p>Chúc mừng bạn đã đăng ký thành công gói tập tại hệ thống của chúng tôi. Dưới đây là thông tin chi tiết về gói tập:</p>
          
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Gói tập:</strong> ${packageType}</p>
            <p style="margin: 5px 0;"><strong>Ngày hết hạn:</strong> <span style="color: #e53e3e; font-weight: bold;">${formattedEndDate}</span></p>
            <p style="margin: 5px 0;"><strong>Giá gói:</strong> ${formattedPrice}</p>
          </div>
          
          <p>Vui lòng đến quầy lễ tân để nhận thẻ cứng và được hướng dẫn chi tiết nếu đây là lần đầu bạn tham gia.</p>
          <p>Chúc bạn có những giờ phút tập luyện hiệu quả!</p>
          <br>
          <p>Trân trọng,<br><strong>Gym Fitness HungDuy</strong></p>
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

module.exports = {
  sendRegistrationEmail,
  sendExpirationReminderEmail
};
