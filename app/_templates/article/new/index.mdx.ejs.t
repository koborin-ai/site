---
to: <%= filePath %>
---
---
title: <%= title %>
description: <%= description %>
ogImage: /og/<%= slug %>.png
publishedAt: <%= new Date().toISOString().split('T')[0] %>
---

{/* Import Image component for local images (MANDATORY for performance) */}
{/* import { Image } from 'astro:assets'; */}
{/* import myImage from '../../assets/<category>/<article>/image.png'; */}

![](/og/<%= slug %>.png)

## Introduction

Write your article content here.

{/* Example: Optimized local image usage */}
{/* <Image src={myImage} alt="Description" width={600} quality={80} /> */}

## Conclusion
