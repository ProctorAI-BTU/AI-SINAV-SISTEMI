const Tenant = require('../models/Tenant');
const { invalidateTenantCache } = require('../middleware/apiKeyAuth');

/**
 * POST /api/admin/tenants
 * Yeni tenant oluştur + API key üret
 */
const createTenant = async (req, res) => {
  const { name, contactEmail, plan, webhookUrl, allowedOrigins, branding, notes } = req.body;

  if (!name || !contactEmail) {
    return res.status(400).json({
      success: false,
      message: 'name ve contactEmail zorunludur.',
    });
  }

  const slug = Tenant.slugify(name);

  // Slug unique mi?
  const existing = await Tenant.findOne({ slug });
  if (existing) {
    return res.status(409).json({
      success: false,
      message: `"${slug}" slug'ı zaten kullanılıyor. Farklı bir kurum adı deneyin.`,
    });
  }

  // API Key üret
  const rawApiKey = Tenant.generateApiKey();
  // Webhook Secret üret
  const webhookSecret = Tenant.generateWebhookSecret();

  const tenant = new Tenant({
    name,
    slug,
    contactEmail,
    plan: plan || 'free',
    webhookUrl: webhookUrl || null,
    webhookSecret,
    allowedOrigins: allowedOrigins || ['*'],
    branding: branding || {},
    notes: notes || '',
  });

  await tenant.setApiKey(rawApiKey);
  await tenant.save();

  // API key sadece oluşturulurken bir kez gösterilir
  res.status(201).json({
    success: true,
    message: 'Tenant başarıyla oluşturuldu.',
    tenant: {
      tenantId: tenant.tenantId,
      name: tenant.name,
      slug: tenant.slug,
      contactEmail: tenant.contactEmail,
      plan: tenant.plan,
      webhookUrl: tenant.webhookUrl,
      allowedOrigins: tenant.allowedOrigins,
      branding: tenant.branding,
      quota: tenant.quota,
      usage: tenant.usage,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
    },
    // Sadece bir kez gösterilir, saklanmalı!
    credentials: {
      apiKey: rawApiKey,
      webhookSecret: webhookSecret,
      warning: '⚠️ Bu API Key bir daha gösterilmeyecek. Güvenli bir yere kaydedin.',
    },
  });
};

/**
 * GET /api/admin/tenants
 * Tüm tenantları listele
 */
const listTenants = async (req, res) => {
  const { page = 1, limit = 20, plan, isActive, search } = req.query;

  const filter = {};
  if (plan) filter.plan = plan;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { contactEmail: { $regex: search, $options: 'i' } },
      { tenantId: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [tenants, total] = await Promise.all([
    Tenant.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Tenant.countDocuments(filter),
  ]);

  res.json({
    success: true,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
    tenants,
  });
};

/**
 * GET /api/admin/tenants/:tenantId
 * Tenant detayı
 */
const getTenant = async (req, res) => {
  const tenant = await Tenant.findOne({ tenantId: req.params.tenantId });
  if (!tenant) {
    return res.status(404).json({ success: false, message: 'Tenant bulunamadı.' });
  }
  res.json({ success: true, tenant });
};

/**
 * PUT /api/admin/tenants/:tenantId
 * Tenant güncelle
 */
const updateTenant = async (req, res) => {
  const { name, contactEmail, plan, webhookUrl, webhookEvents, allowedOrigins, branding, isActive, notes, quota } =
    req.body;

  const tenant = await Tenant.findOne({ tenantId: req.params.tenantId });
  if (!tenant) {
    return res.status(404).json({ success: false, message: 'Tenant bulunamadı.' });
  }

  if (name) tenant.name = name;
  if (contactEmail) tenant.contactEmail = contactEmail;
  if (plan) tenant.plan = plan;
  if (webhookUrl !== undefined) tenant.webhookUrl = webhookUrl;
  if (webhookEvents) tenant.webhookEvents = webhookEvents;
  if (allowedOrigins) tenant.allowedOrigins = allowedOrigins;
  if (branding) tenant.branding = { ...tenant.branding, ...branding };
  if (isActive !== undefined) tenant.isActive = isActive;
  if (notes !== undefined) tenant.notes = notes;
  if (quota) tenant.quota = { ...tenant.quota, ...quota };

  await tenant.save();

  // Cache'i temizle
  if (tenant.apiKeyPrefix) {
    invalidateTenantCache(tenant.apiKeyPrefix.slice(0, 16));
  }

  res.json({ success: true, message: 'Tenant güncellendi.', tenant });
};

/**
 * POST /api/admin/tenants/:tenantId/regenerate-key
 * API Key yenile
 */
const regenerateApiKey = async (req, res) => {
  const tenant = await Tenant.findOne({ tenantId: req.params.tenantId });
  if (!tenant) {
    return res.status(404).json({ success: false, message: 'Tenant bulunamadı.' });
  }

  const rawApiKey = Tenant.generateApiKey();
  await tenant.setApiKey(rawApiKey);
  await tenant.save();

  // Eski cache'i temizle
  invalidateTenantCache(tenant.apiKeyPrefix ? tenant.apiKeyPrefix.slice(0, 16) : '');

  res.json({
    success: true,
    message: 'API Key yenilendi.',
    credentials: {
      apiKey: rawApiKey,
      warning: '⚠️ Eski API Key artık geçersizdir. Yeni key\'i güvenli bir yere kaydedin.',
    },
  });
};

/**
 * POST /api/admin/tenants/:tenantId/regenerate-webhook-secret
 * Webhook Secret yenile
 */
const regenerateWebhookSecret = async (req, res) => {
  const tenant = await Tenant.findOne({ tenantId: req.params.tenantId });
  if (!tenant) {
    return res.status(404).json({ success: false, message: 'Tenant bulunamadı.' });
  }

  const newSecret = Tenant.generateWebhookSecret();
  tenant.webhookSecret = newSecret;
  await tenant.save();

  res.json({
    success: true,
    message: 'Webhook secret yenilendi.',
    webhookSecret: newSecret,
  });
};

/**
 * DELETE /api/admin/tenants/:tenantId
 * Tenant deaktive et (soft delete)
 */
const deactivateTenant = async (req, res) => {
  const tenant = await Tenant.findOne({ tenantId: req.params.tenantId });
  if (!tenant) {
    return res.status(404).json({ success: false, message: 'Tenant bulunamadı.' });
  }

  tenant.isActive = false;
  await tenant.save();

  if (tenant.apiKeyPrefix) {
    invalidateTenantCache(tenant.apiKeyPrefix.slice(0, 16));
  }

  res.json({ success: true, message: 'Tenant deaktive edildi.' });
};

/**
 * GET /api/admin/stats
 * Genel istatistikler
 */
const getStats = async (req, res) => {
  const [totalTenants, activeTenants, byPlan] = await Promise.all([
    Tenant.countDocuments(),
    Tenant.countDocuments({ isActive: true }),
    Tenant.aggregate([
      { $group: { _id: '$plan', count: { $sum: 1 }, totalExams: { $sum: '$usage.totalExams' } } },
    ]),
  ]);

  res.json({
    success: true,
    stats: {
      totalTenants,
      activeTenants,
      byPlan: byPlan.reduce((acc, item) => {
        acc[item._id] = { count: item.count, totalExams: item.totalExams };
        return acc;
      }, {}),
    },
  });
};

module.exports = {
  createTenant,
  listTenants,
  getTenant,
  updateTenant,
  regenerateApiKey,
  regenerateWebhookSecret,
  deactivateTenant,
  getStats,
};
