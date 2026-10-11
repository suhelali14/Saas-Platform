import prisma from '../../lib/prisma';
import { NotFoundError } from '../../lib/errors';
import { getPaginationParams, createPaginatedResult } from '../../lib/utils';

export async function getEmployees(businessId: string, query: any) {
  const { skip, take, page, limit } = getPaginationParams(query);
  const { search } = query;

  const where: any = { businessId, isActive: true };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { role: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      orderBy: { name: 'asc' },
      skip,
      take,
    }),
    prisma.employee.count({ where }),
  ]);

  return createPaginatedResult(employees, total, page, limit);
}

export async function getEmployeeById(businessId: string, id: string) {
  const employee = await prisma.employee.findFirst({
    where: { id, businessId },
    include: {
      appointments: {
        where: { scheduledAt: { gte: new Date() } },
        orderBy: { scheduledAt: 'asc' },
        take: 5,
        include: {
          customer: { select: { name: true, phone: true } },
          service: { select: { name: true, duration: true, price: true } },
        },
      },
    },
  });
  if (!employee) throw new NotFoundError('Employee');
  return employee;
}

export async function createEmployee(businessId: string, data: any) {
  return prisma.employee.create({
    data: {
      businessId,
      name: data.name,
      phone: data.phone,
      email: data.email,
      role: data.role,
      department: data.department,
      workingHours: data.workingHours,
      isAvailable: data.isAvailable !== false,
    },
  });
}

export async function updateEmployee(businessId: string, id: string, data: any) {
  const existing = await prisma.employee.findFirst({ where: { id, businessId } });
  if (!existing) throw new NotFoundError('Employee');

  return prisma.employee.update({
    where: { id },
    data: {
      name: data.name,
      phone: data.phone,
      email: data.email,
      role: data.role,
      department: data.department,
      workingHours: data.workingHours,
      isAvailable: data.isAvailable,
    },
  });
}

export async function deleteEmployee(businessId: string, id: string) {
  const existing = await prisma.employee.findFirst({ where: { id, businessId } });
  if (!existing) throw new NotFoundError('Employee');
  return prisma.employee.update({ where: { id }, data: { isActive: false } });
}
