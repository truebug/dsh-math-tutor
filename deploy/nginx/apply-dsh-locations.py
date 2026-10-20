#!/usr/bin/env python3
"""把 dsh-math-tutor 的限流 location 幂等写入 nginx 站点配置。"""
import re, sys

path = sys.argv[1] if len(sys.argv) > 1 else '/etc/nginx/sites-enabled/default'
src = open(path, encoding='utf-8').read()

MARK = '# >>> dsh-math-tutor hardening'
if MARK in src:
    print('already patched')
    sys.exit(0)

LLM_BLOCK = '''    # >>> dsh-math-tutor hardening
    # LLM 路由：独立限流 + 关闭缓冲（SSE 逐字输出）
    location ~ ^/api/(chat|hint|review|sprite-advice|weekly-report) {
        limit_req zone=dsh_llm burst=5 nodelay;
        limit_conn dsh_conn 10;
        client_max_body_size 64k;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_http_version 1.1;
        proxy_read_timeout 70s;
        proxy_buffering off;
        proxy_pass http://127.0.0.1:8787;
    }
    # <<< dsh-math-tutor hardening

'''

pattern = re.compile(r'(?m)^([ \t]*)location /api/ \{')
m = pattern.search(src)
if not m:
    print('ERROR: /api/ location not found', file=sys.stderr)
    sys.exit(2)

indent = m.group(1)
src = src[:m.start()] + LLM_BLOCK + src[m.start():]
m = pattern.search(src, m.start() + len(LLM_BLOCK))

# 在 /api/ location 内补限流与体积上限（紧跟大括号）
insert_at = src.index('{', m.start()) + 1
src = (src[:insert_at] +
       '\n' + indent + '    limit_req zone=dsh_api burst=20 nodelay;\n' +
       indent + '    limit_conn dsh_conn 20;\n' +
       indent + '    client_max_body_size 64k;\n' +
       src[insert_at:])

open(path, 'w', encoding='utf-8').write(src)
print('patched', path)
