import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../lib/prisma';
import { ConflictError, UnauthorizedError, ValidationError } from '../../lib/errors';
import { uniqueSlug } from '../../lib/utils';
import { BusinessType } from '@prisma/client';

interface RegisterInput {
  email: string;
  password: string;
  name: string;
  phone?: string;
  businessName: string;
  businessType?: BusinessType;
}

interface LoginInput {
  email: string;
  password: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  business: {
    id: string;
    name: string;
    slug: string;
    type: BusinessType;
    onboardingCompleted: boolean;
  };
  tokens: AuthTokens;
}

function generateTokens(userId: string, businessId: string, email: string, role: string): AuthTokens {
  const accessToken = jwt.sign(
    { userId, businessId, email, role },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );

  const refreshToken = jwt.sign(
    { userId, businessId, email, role },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '30d' }
  );

  return { accessToken, refreshToken };
}

export async function registerUser(input: RegisterInput): Promise<AuthResponse> {
  const { email, password, name, phone, businessName, businessType } = input;

  // Validate
  if (!email || !password || !name || !businessName) {
    throw new ValidationError('Missing required fields', {
      email: !email ? 'Email is required' : '',
      password: !password ? 'Password is required' : '',
      name: !name ? 'Name is required' : '',
      businessName: !businessName ? 'Business name is required' : '',
    });
  }

  if (password.length < 6) {
    throw new ValidationError('Password must be at least 6 characters');
  }

  // Check existing user
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new ConflictError('An account with this email already exists');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create business + user in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create business
    const business = await tx.business.create({
      data: {
        name: businessName,
        slug: uniqueSlug(businessName),
        type: businessType || 'RETAIL_STORE',
        email: email,
        phone: phone,
      },
    });

    // Create user as owner
    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        role: 'OWNER',
        businessId: business.id,
      },
    });

    return { user, business };
  });

  const tokens = generateTokens(result.user.id, result.business.id, email, result.user.role);

  return {
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      role: result.user.role,
    },
    business: {
      id: result.business.id,
      name: result.business.name,
      slug: result.business.slug,
      type: result.business.type,
      onboardingCompleted: result.business.onboardingCompleted,
    },
    tokens,
  };
}

export async function loginUser(input: LoginInput): Promise<AuthResponse> {
  const { email, password } = input;

  if (!email || !password) {
    throw new ValidationError('Email and password are required');
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { business: true },
  });

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (!user.isActive) {
    throw new UnauthorizedError('Account is deactivated');
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const tokens = generateTokens(user.id, user.businessId, user.email, user.role);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    business: {
      id: user.business.id,
      name: user.business.name,
      slug: user.business.slug,
      type: user.business.type,
      onboardingCompleted: user.business.onboardingCompleted,
    },
    tokens,
  };
}

export async function refreshUserToken(token: string): Promise<AuthTokens> {
  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as any;
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid refresh token');
    }
    return generateTokens(user.id, user.businessId, user.email, user.role);
  } catch {
    throw new UnauthorizedError('Invalid refresh token');
  }
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { business: true },
    omit: { password: true },
  });

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  return user;
}
