
# 目录结构
```
app/
├── static
│   ├── css
│   │   ├── input.css
│   │   └── app966.css
│   ├──js
│   │   └── app966.js
│   └── images
├── templates
│   └── index.html
├── app.py
├── auth.py
├── datebase.py
├── init_db.py
├── models.py
├── main.py
├── sendEmail.py
├── Dockerfile
├── README.md
├── requirements.txt
├── .env
├── uwsgi.ini
└── package.json
└── tailwind.config.js
```

# 环境要求
  - Python 3.9+
  - Node 20+

# 快速开始
```CMD
pip install -r requirements.txt
npm install
python init_db.py
npm run build
```
# 配置环境变量
  - 编辑 `.env` 文件，填写数据库连接、Redis主机、Redis端口、Redis密码、发送邮箱地址、发送邮箱密码等信息。

# Docker 部署
```CMD
docker build -t wjdrcode:1.0 .
docker run -d -p 5201:5201 --name wjdr wjdrcode:1.0
```

# 体验
  - [app966.cn](https://wjdr.app966.cn/)
