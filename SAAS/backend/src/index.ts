import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';

// Routes
import authRoutes from './modules/auth/auth.routes';
import businessRoutes from './modules/business/business.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import customerRoutes from './modules/customer/customer.routes';
import catalogRoutes from './modules/catalog/catalog.routes';
import orderRoutes from './modules/order/order.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import employeeRoutes from './modules/employee/employee.routes';
import conversationRoutes from './modules/conversation/conversation.routes';
import whatsappRoutes from './modules/whatsapp/whatsapp.routes';
import aiRoutes from './modules/ai/ai.routes';
import websiteRoutes from './modules/website/website.routes';
import paymentRoutes from './modules/payment/payment.routes';
import growthRoutes from './modules/growth/growth.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';

// Middleware
import { errorMiddleware } from './middleware/error';

const app = express();
const httpServer = createServer(app);

// ============================================================================
// MIDDLEWARE
// ============================================================================

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.options('*', cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================================================
// ROUTES
// ============================================================================

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    name: 'BusinessOS API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Phase 2: Core modules
app.use('/api/customers', customerRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/employees', employeeRoutes);

// Phase 3 & 4: Intelligence, Payments, Growth & Analytics
app.use('/api/conversations', conversationRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/website', websiteRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/growth', growthRoutes);
app.use('/api/analytics', analyticsRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use(errorMiddleware);

// ============================================================================
// START SERVER
// ============================================================================

const PORT = parseInt(process.env.PORT || '3001', 10);

httpServer.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║                                              ║');
  console.log('  ║   🚀 BusinessOS API Server                   ║');
  console.log(`  ║   Running on http://localhost:${PORT}            ║`);
  console.log('  ║                                              ║');
  console.log('  ║   "You run your business. We handle rest."   ║');
  console.log('  ║                                              ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
});

export default app;
