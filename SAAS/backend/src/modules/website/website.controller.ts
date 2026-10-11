import { Request, Response, NextFunction } from 'express';
import {
  getWebsiteConfig,
  saveWebsiteConfig,
  generateWebsiteHTML,
  processPublicStorefrontOrder,
} from './website.service';
import { generateStorefrontWithAI } from './website.ai';
import prisma from '../../lib/prisma';
import { NotFoundError, UnauthorizedError } from '../../lib/errors';
import { generateReactAppAndExportToGitHub } from './react-export.service';

export async function getConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getWebsiteConfig(req.user!.businessId);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function updateConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await saveWebsiteConfig(req.user!.businessId, req.body);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function getPreview(req: Request, res: Response, next: NextFunction) {
  try {
    const html = await generateWebsiteHTML(req.user!.businessId);
    if (req.query['format'] === 'html') {
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    }
    res.json({ success: true, data: { html } });
  } catch (e) { next(e); }
}

export async function generateAI(req: Request, res: Response, next: NextFunction) {
  try {
    const prompt = req.body.prompt as string | undefined;
    const aiData = await generateStorefrontWithAI(req.user!.businessId, prompt);

    // Save generated config into database
    await saveWebsiteConfig(req.user!.businessId, {
      theme: aiData.theme,
      blocks: aiData.blocks,
    });

    const html = await generateWebsiteHTML(req.user!.businessId);
    res.json({ success: true, data: { aiData, html } });
  } catch (e) { next(e); }
}

export async function exportToGithub(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId = req.user?.businessId;
    const { repoName } = req.body;
    
    if (!businessId) throw new UnauthorizedError();
    if (!repoName) throw new Error('Repository name is required');

    const githubRepoUrl = await generateReactAppAndExportToGitHub(businessId, repoName);

    res.json({ success: true, url: githubRepoUrl });
  } catch (e) {
    next(e);
  }
}

export async function renderPublicWebsite(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.params['slug'] as string;
    let business = await prisma.business.findUnique({ where: { slug } });
    if (!business) {
      business = await prisma.business.findFirst({ where: { isActive: true } }) ||
                 await prisma.business.findFirst();
    }
    if (!business) throw new NotFoundError('Website');

    const html = await generateWebsiteHTML(business.id);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (e) { next(e); }
}

export async function checkoutPublic(req: Request, res: Response, next: NextFunction) {
  try {
    const { slugOrId, customerName, customerPhone, deliveryAddress, items, paymentMethod, notes } = req.body;
    const result = await processPublicStorefrontOrder(slugOrId, {
      customerName,
      customerPhone,
      deliveryAddress,
      items,
      paymentMethod,
      notes,
    });
    res.status(201).json({ success: true, data: result });
  } catch (e) { next(e); }
}

export async function getTemplateByCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const category = req.params['category'] as string;
    const templates = await prisma.componentTemplate.findMany({
      where: { category },
      take: 1
    });
    const templateHtml = templates.length > 0 ? templates[0].htmlContent : `<section class="p-20 text-center text-white bg-slate-900"><h2 class="text-3xl">${category}</h2></section>`;
    res.json({ success: true, data: { html: templateHtml } });
  } catch (e) { next(e); }
}
