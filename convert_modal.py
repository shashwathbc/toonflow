import re

with open('src/components/novel/CreateNovelModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Base replacements
content = content.replace('CreateNovelModal', 'CreateWebtoonModal')
content = content.replace('createNovel', 'createWebtoon')
content = content.replace('updateNovel', 'updateWebtoon')
content = content.replace('uploadNovelCover', 'uploadWebtoonCover')
content = content.replace('uploadNovelBanner', 'uploadWebtoonBanner')
content = content.replace('editNovel', 'editWebtoon')
content = content.replace('Novel', 'Webtoon')
content = content.replace('novelId', 'webtoonId')
content = content.replace('novel-title', 'webtoon-title')
content = content.replace('novel-synopsis', 'webtoon-synopsis')
content = content.replace('novel-tags', 'webtoon-tags')
content = content.replace('novel-status', 'webtoon-status')
content = content.replace('novel-visibility', 'webtoon-visibility')
content = content.replace('create-novel-title', 'create-webtoon-title')
content = content.replace('novel', 'webtoon')
content = content.replace('Novel', 'Webtoon')
content = content.replace('NOVEL', 'WEBTOON')
content = content.replace('novels', 'webtoons')
content = content.replace('Novels', 'Webtoons')

# Revert specific API payload fields
content = content.replace("webtoonTitle:", "novelTitle:")
content = content.replace("/api/ai/webtoon-content", "/api/ai/novel-content")
content = content.replace("@/components/webtoon/AIImageGenerator", "@/components/novel/AIImageGenerator")

# Fix Title label
content = content.replace("Your webtoon's title", "Your webtoon's title")

with open('src/components/webtoon/CreateWebtoonModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Modal converted successfully.")
