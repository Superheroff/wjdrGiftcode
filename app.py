import requests
import time
import base64
import hashlib
import json
import ddddocr
from fake_useragent import UserAgent
from datetime import datetime
from urllib.parse import quote
import pytz
import re

headers = {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'zh-CN,zh;q=0.9',
    'cache-control': 'no-cache',
    'content-type': 'application/x-www-form-urlencoded',
    'origin': 'https://wjdr-giftcode.centurygames.cn',
    'pragma': 'no-cache',
    'priority': 'u=1, i',
    'referer': 'https://wjdr-giftcode.centurygames.cn/',
}

def setHeaders():
    ua = UserAgent()
    user_agent = ua.random
    headers['User-Agent'] = user_agent

setHeaders()

def generate_sign(data):
    sorted_keys = sorted(data.keys())
    query_string_parts = []
    for key in sorted_keys:
        value = data[key]
        # 处理值并转换为字符串
        if isinstance(value, (dict, list)):
            str_value = json.dumps(value, ensure_ascii=False)
        else:
            str_value = str(value)
        # 检查是否需要URL编码（包含非ASCII字符）
        if any(ord(char) > 127 for char in str_value):  # 检查是否有非ASCII字符
            str_value = quote(str_value, safe='')
        query_string_parts.append(f"{key}={str_value}")
    query_string = '&'.join(query_string_parts)
    fixed_string = "Uiv#87#SPan.ECsp"
    sign_string = query_string + fixed_string
    md5_hash = hashlib.md5(sign_string.encode('utf-8')).hexdigest()
    result = {
        'sign': md5_hash,
        **data
    }
    return result


def login_fid(fid):
    timestamp = round(time.time() * 1000)
    data = {
        "fid": fid,
        "time": str(timestamp),
    }
    data = generate_sign(data)
    url_login = "https://wjdr-giftcode-api.campfiregames.cn/api/player"
    response = requests.post(
        url_login,
        headers=headers,
        data=data
    )
    try:
        response_data = response.json()
        if response_data['code'] == 0:
            msg = response_data['data']
            if msg.get('stove_lv', 0) < 9:
                return '大熔炉等级低于9，账号已删除'
            if msg.get('total_recharge_amount'):
                del msg['total_recharge_amount']
        elif response_data.get('msg') == 'role not exist.':
            msg = "用户角色不存在，账号已删除"
        else:
            msg = response_data.get('msg')
    except Exception:
        msg = "无此用户"
    return msg


def get_captcha_code(fid):
    timestamp = round(time.time() * 1000)
    data = {
        "fid": fid,
        "time": str(timestamp),
        "init": 0,
    }
    data = generate_sign(data)
    url_captcha = "https://wjdr-giftcode-api.campfiregames.cn/api/captcha"
    res = requests.post(
        url_captcha,
        headers=headers,
        data=data
    )
    try:
        response_data = res.json()
        code = response_data.get('code', 10086)
        if code != 0:
            return "验证码请求失败"
        captcha_img_base64 = response_data['data']['img']
        captcha_img_base64 = captcha_img_base64.split(',')[1]
        captcha_img_bytes = base64.b64decode(captcha_img_base64)
        ocr = ddddocr.DdddOcr()
        result = ocr.classification(captcha_img_bytes)
        return result
    except Exception as e:
        return '验证码请求失败'



def _gift(fid, cdk, captcha_code):
    if not captcha_code or len(captcha_code) < 4 or captcha_code == '验证码请求失败':
        return "验证码识别错误", 1
    timestamp = round(time.time() * 1000)
    data = {
        "fid": fid,
        "cdk": cdk,
        "captcha_code": str(captcha_code),
        "time": str(timestamp)
    }
    data = generate_sign(data)
    url = "https://wjdr-giftcode-api.campfiregames.cn/api/gift_code"
    try:
        response = requests.post(url, headers=headers, data=data).json()
        message = response['msg']
        if message == "SUCCESS":
            return "兑换成功", 0
        elif message == "RECEIVED." or message == "USED.":
            return "已经兑换过了", 2
        elif message == "TIME ERROR.":
            return "不在兑换时间内", 3
        elif message == "STOVE_LV ERROR.":
            return "大熔炉等级过低", 4
        elif message == "CAPTCHA CHECK ERROR.":
            return "验证码错误", 5
        elif message == "CAPTCHA CHECK TOO FREQUENT.":
            return "服务器繁忙，请稍候再试", 6
        elif message == "CAPTCHA EXPIRED.":
            return "验证码已过期", 7
        elif message == "NOT LOGIN.":
            return "登录已过期", 8
        elif message == "SAME TYPE EXCHANGE.":
            return "兑换过同类型的礼包", 9
        elif message == "TIMEOUT RETRY.":
            return "超时请重试", 10
        elif message == "CDK NOT FOUND.":
            return "兑换码不存在", 11
        else:
            return message, 100
    except Exception:
        return "请求错误", 101

def _run(fid, cdk):
    """一人兑换一个"""
    userInfo = login_fid(fid)
    if isinstance(userInfo, str):
        return userInfo
    keyCode = get_captcha_code(fid)
    result, code = _gift(fid, cdk, keyCode)
    if code in [1, 5, 7, 10] or keyCode == '验证码请求失败':
        setHeaders()
        keyCode = get_captcha_code(fid)
        result, code = _gift(fid, cdk, keyCode)
    elif code == 8:
        setHeaders()
        userInfo = login_fid(fid)
        if isinstance(userInfo, str):
            return userInfo
        keyCode = get_captcha_code(fid)
        result, code = _gift(fid, cdk, keyCode)
    userInfo['cdk'] = cdk
    return {'msg': result, 'code': code, 'userInfo': userInfo}


def _runAll(fid, cdkList):
    """一人兑换所有,统计成功失败数"""
    userInfo = login_fid(fid)
    if isinstance(userInfo, str):
        return userInfo
    count_error = 0
    count_success = 0
    cdk_success = ''
    cdk_res = ''  # 记录重复兑换的下次不兑换
    for cdk in cdkList:
        # print(f"当前兑换cdk:{cdk},兑换人:{fid}")
        keyCode = get_captcha_code(fid)
        # print("验证码识别结果", keyCode)
        _, code = _gift(fid, cdk, keyCode)
        # print("兑换结果", _, code)
        if code in [1, 5, 7, 10] or keyCode == '验证码请求失败':
            setHeaders()
            keyCode = get_captcha_code(fid)
            _, code = _gift(fid, cdk, keyCode)
            count_error+=1
        elif code == 8:
            setHeaders()
            userInfo = login_fid(fid)
            if isinstance(userInfo, str):
                return userInfo
            keyCode = get_captcha_code(fid)
            _, code = _gift(fid, cdk, keyCode)
        if code == 0:
            count_success += 1
            cdk_success += cdk + ','
        elif code == 2:
            cdk_res += cdk + ','
        time.sleep(2.5)
    userInfo['cdk'] = cdk_success[:-1]
    userInfo['cdk_res'] = cdk_res[:-1]
    return {'count_error': count_error, 'count_success': count_success, 'userInfo': userInfo}


def _runUserAll(userCdkList: dict):
    """
    一键兑换所有
    :param userCdkList: 未使用兑换码的用户和兑换码列表
    :return:
    """
    data = []
    deleteUser = []
    for key, value in userCdkList.items():
        # print(f"正在帮{key}兑换", value)
        result = _runAll(key, value)
        # print(result)
        if any(key in result for key in ('大熔炉等级低于9', '用户角色不存在')):
            deleteUser.append(key)
            continue
        if isinstance(result, str):
            continue
        data.append(result)
        time.sleep(2)
    return data, deleteUser


def cookie_to_dict(cookie_str):
    """将cookie字符串转换为字典"""
    cookie_dict = {}
    for item in cookie_str.split(';'):
        # 去除前后空格
        item = item.strip()
        if '=' in item:
            key, value = item.split('=', 1)
            cookie_dict[key.strip()] = value.strip()
    return cookie_dict

def extract_redemption_codes(text):
    pattern = r'\s*\n\s*([A-Z0-9]+)\s*\n\s*\n\s*有效期至\s*：\s*(\d{4}-\d{2}-\d{2}\s*\d{2}:\d{2}:\d{2})'
    matches = re.findall(pattern, text)
    return matches


class xhsApi:
    def __init__(self):
        self.cid = 'd9ba8ae07d955b83c3b04280f3dc5a4a'
        self.cookie = ''
        self.userAgent = ''
        self._headers = None

    def init(self):
        self.setCookie()
        self.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
        # self.setUserAgent()
        self._headers = {
            'accept-language': 'zh-CN,zh;q=0.9',
            'cache-control': 'no-cache',
            'origin': 'https://www.xiaohongshu.com',
            'pragma': 'no-cache',
            'priority': 'u=1, i',
            'referer': 'https://www.xiaohongshu.com/',
            'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
            'user-agent': self.userAgent
        }

    @staticmethod
    def string_to_timestamp(time_str: str, timezone='Asia/Shanghai') -> str:
        """将时间字符串转换为时间戳（秒级）"""
        try:
            # 解析时间字符串
            dt = datetime.strptime(time_str, '%Y-%m-%d %H:%M:%S')
            # 明确指定时区
            tz = pytz.timezone(timezone)
            dt_localized = tz.localize(dt)
            # 转换为时间戳（秒级）
            timestamp = int(dt_localized.timestamp())
            return str(timestamp)
        except ValueError as e:
            print(f"时间格式错误: {e}")
            return ''

    @property
    def __AppKey(self):
        data = self.cid + '5c6b8r9a'
        return hashlib.sha256(data.encode('utf-8')).hexdigest()

    @property
    def set_sign(self):
        ts = str(time.time()).split('.')[0]
        string = '1005' + self.cid + ts + self.__AppKey
        sign = hashlib.md5(string.encode('utf8')).hexdigest()
        return sign


    def _Sign(self, url: str, cookie:str, user_agent:str, body=''):
        url_sign = 'http://api2.52jan.com/xhsapi/web/sign'
        data = {
            "url": url,
            "cookie": cookie,
            "data": body,
            "user_agent": user_agent
        }
        ts = str(time.time()).split('.')[0]
        data['sign'] = self.set_sign
        res = requests.post(url=url_sign, data=data, headers={'cid': self.cid, 'timestamp': ts}).json()
        return res

    def setUserAgent(self):
        ua = UserAgent(browsers='Chrome')
        self.userAgent = ua.random

    def setCookie(self):
        self.cookie = requests.get('https://www.app966.cn/zhushou/xhs.txt').text


    def getPost(self):
        """获取小红书用户笔记"""
        url = 'https://edith.xiaohongshu.com/api/sns/web/v1/user_posted?num=30&cursor=&user_id=5ea676d500000000010065f3&image_formats=jpg,webp,avif&xsec_token=&xsec_source=pc_feed'
        sign = self._Sign(url, cookie=self.cookie, user_agent=self.userAgent)
        self._headers['accept'] = 'application/json, text/plain, */*'
        self._headers['cookie'] = self.cookie
        self._headers.update(sign)
        res = requests.get(url, headers=self._headers).json()
        # print("获取小红书用户笔记", res)
        return res


    def PostInfo(self, total=20):
        """解析小红书笔记内容"""
        result = self.getPost()
        if result.get('code') != 0:
            print("状态：", result.get('msg'))
            return
        index = 0
        codeList = []
        self._headers['accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7'
        try:
            for d in result['data']['notes']:
                if index >= total:
                    break
                title = d['display_title']
                title_list = ['兑换', '更新', '活动']
                if any(item in title for item in title_list):
                    url = f'https://www.xiaohongshu.com/explore/{d["note_id"]}?xsec_token={d["xsec_token"]}'
                    content = requests.get(url, headers=self._headers).text
                    res = extract_redemption_codes(content)
                    if not res:
                        continue
                    code = [res[0][0], xhsApi.string_to_timestamp(res[0][1])]
                    codeList.append(code)
                    time.sleep(1)
                index += 1

        except KeyError or IndexError:
            pass
        return codeList


if __name__ == '__main__':
    pass
    # api = xhsApi()
    # api.init()
    # codeList = api.PostInfo(10)
    # print(codeList)
    # _run('661455442', 'WJDR350W')

