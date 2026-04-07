import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header
from dotenv import load_dotenv

load_dotenv()
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")
SEND_EMAIL = os.getenv("SEND_EMAIL")

def send_email_simple(receiver_email, content):
    """发送简单文本邮件"""
    # 邮件配置
    smtp_server = "smtp.qq.com"  # QQ邮箱SMTP服务器
    port = 587  # 对于TLS
    sender_email = SEND_EMAIL
    password = EMAIL_PASSWORD  # 邮箱授权码，不是登录密码

    # 创建邮件内容
    subject = "【胖达网络】无尽冬日CDK兑换通知！"

    # 创建邮件对象
    message = MIMEMultipart()
    message["From"] = sender_email
    message["To"] = receiver_email
    message["Subject"] = Header(subject, 'utf-8')

    # 添加邮件正文
    message.attach(MIMEText(content, "plain", "utf-8"))

    try:
        # 创建SMTP连接
        server = smtplib.SMTP(smtp_server, port)
        server.starttls()  # 启用TLS加密
        server.login(sender_email, password)
        server.sendmail(sender_email, receiver_email, message.as_string())
        server.quit()
        print("邮件发送成功！")
        return True
    except Exception as e:
        print(f"邮件发送失败: {e}")
        return False


def send_html_email(receiver_email, username, fid, codes):
    """发送HTML格式邮件"""
    smtp_server = "smtp.qq.com"
    port = 587
    sender_email = "838210720@qq.com"
    password = "mnquszljnuhcbdaa"

    subject = "【胖达网络】无尽冬日CDK兑换通知！"

    # HTML内容
    html_body = ("""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                .notification {{
                    font-family: 'Arial', sans-serif;
                    max-width: 600px;
                    margin: 0 auto;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 15px;
                    padding: 30px;
                    color: white;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                }}
                .notification-header {{
                    text-align: center;
                    margin-bottom: 25px;
                }}
                .notification-icon {{
                    font-size: 48px;
                    margin-bottom: 15px;
                }}
                .notification-title {{
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 10px;
                }}
                .notification-content {{
                    background: rgba(255,255,255,0.1);
                    padding: 20px;
                    border-radius: 10px;
                    margin-bottom: 20px;
                }}
                .notification-button {{
                    display: inline-block;
                    background: white;
                    color: #667eea;
                    padding: 12px 30px;
                    text-decoration: none;
                    border-radius: 25px;
                    font-weight: bold;
                    transition: all 0.3s ease;
                }}
            </style>
        </head>
        <body>
            <div class="notification">
                <div class="notification-header">
                    <div class="notification-icon">🎉</div>
                    <div class="notification-title">兑换成功！</div>
                </div>
                <div class="notification-content">
                    <p>已成功兑换礼包至游戏账户中，兑换详情如下</p>
                    <p><strong>游戏昵称：</strong> {0}</p>
                    <p><strong>游戏ID：</strong> {1}</p>
                    <p><strong>兑换码：</strong> {2}</p>
                </div>
                <div style="text-align: center;">
                    <a href="javascript:void(0)" class="notification-button">我知道了</a>
                </div>
            </div>
        </body>
        </html>""").format(username, fid, codes)

    message = MIMEMultipart()
    message["From"] = sender_email
    message["To"] = receiver_email
    message["Subject"] = Header(subject, 'utf-8')

    # 添加HTML正文
    message.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        server = smtplib.SMTP(smtp_server, port)
        server.starttls()
        server.login(sender_email, password)
        server.sendmail(sender_email, receiver_email, message.as_string())
        server.quit()
        # print("HTML邮件发送成功！")
        return True
    except Exception as e:
        # print(f"邮件发送失败: {e}")
        return False

# 使用示例
# send_email_simple("690518713@qq.com", "兑换码：WJDR350W已成功兑换至游戏账户中，请查收")
# send_html_email('690518713@qq.com', '胖达历险记', "324323423", 'WJDR350W')