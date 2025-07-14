import { PrismaClient } from '../../../node_modules/.prisma/work-module';
import { PrismaClient as SharedPrismaClient } from '../../../node_modules/.prisma/shared-kernel';
import { PrismaClient as AssetsPrismaClient } from '../../../node_modules/.prisma/assets-module';

const prisma = new PrismaClient();
const sharedPrisma = new SharedPrismaClient();
const assetsPrisma = new AssetsPrismaClient();

async function main() {
  console.log('🌱 Seeding work-module database...');

  // Get Manchester Airport organization and users
  const manchesterOrg = await sharedPrisma.organization.findUnique({
    where: { code: 'MAN' },
  });

  if (!manchesterOrg) {
    throw new Error('Manchester Airport organization not found. Run shared-kernel seed first.');
  }

  const users = await sharedPrisma.user.findMany({
    where: { organizationId: manchesterOrg.id },
  });

  const requester = users.find((u) => u.role === 'requester');
  const assetOwner = users.find((u) => u.role === 'asset_owner');

  if (!requester || !assetOwner) {
    throw new Error('Required users not found. Run shared-kernel seed first.');
  }

  // Get some stands from Manchester
  const stands = await assetsPrisma.stand.findMany({
    where: {
      organizationId: manchesterOrg.id,
      status: 'operational',
    },
    take: 5,
  });

  if (stands.length === 0) {
    throw new Error('No stands found. Run assets-module seed first.');
  }

  // Create work request templates
  const templates = [
    {
      name: 'Stand Maintenance',
      description: 'Standard maintenance request for aircraft stands',
      assetType: 'stand',
      defaultTitle: 'Routine Stand Maintenance',
      defaultDesc:
        'Scheduled maintenance work on aircraft stand including pavement inspection, marking refresh, and equipment check.',
      defaultImpact:
        'Stand will be closed for the duration of the work. Adjacent stands may have restricted access.',
    },
    {
      name: 'Emergency Repair',
      description: 'Emergency repair request template',
      assetType: 'stand',
      defaultTitle: 'Emergency Repair Required',
      defaultDesc: 'Urgent repair work required due to damage or safety concern.',
      defaultImpact: 'Stand closed immediately. Safety perimeter may affect adjacent stands.',
    },
    {
      name: 'Equipment Upgrade',
      description: 'Equipment upgrade or installation',
      assetType: 'stand',
      defaultTitle: 'Equipment Upgrade',
      defaultDesc:
        'Installation or upgrade of stand equipment (power units, guidance systems, etc.)',
      defaultImpact: 'Stand operational with restrictions during work hours.',
    },
  ];

  for (const template of templates) {
    await prisma.workRequestTemplate.create({
      data: {
        organizationId: manchesterOrg.id,
        ...template,
        createdBy: 'system',
        updatedBy: 'system',
      },
    });
    console.log(`✅ Created template: ${template.name}`);
  }

  // Create sample work requests
  const workRequests = [
    {
      assetId: stands[0].id,
      assetType: 'stand',
      assetCode: stands[0].code,
      title: 'Routine Pavement Inspection - Stand ' + stands[0].code,
      description:
        'Annual pavement condition inspection and minor repairs as required. This includes crack sealing and remarking of stand guidelines.',
      requestedBy: requester.id,
      requestorName: requester.name,
      requestorEmail: requester.email,
      startDate: new Date('2025-02-01'),
      endDate: new Date('2025-02-03'),
      status: 'approved',
      priority: 'normal',
      impact: 'Stand closed for 3 days. Aircraft will need to use alternative stands.',
      reviewedBy: assetOwner.id,
      reviewedAt: new Date('2025-01-15'),
      reviewerName: assetOwner.name,
      reviewComments:
        'Approved. Please coordinate with operations for stand allocation during closure.',
    },
    {
      assetId: stands[1].id,
      assetType: 'stand',
      assetCode: stands[1].code,
      title: 'GPU Installation - Stand ' + stands[1].code,
      description:
        'Installation of new Ground Power Unit (GPU) to support larger aircraft operations.',
      requestedBy: requester.id,
      requestorName: requester.name,
      requestorEmail: requester.email,
      startDate: new Date('2025-02-15'),
      endDate: new Date('2025-02-20'),
      status: 'submitted',
      priority: 'high',
      impact:
        'Stand remains operational but with restrictions. No wide-body aircraft during installation.',
      affectedAreas: ['power_systems', 'underground_utilities'],
    },
    {
      assetId: stands[2].id,
      assetType: 'stand',
      assetCode: stands[2].code,
      title: 'Emergency FOD Repair - Stand ' + stands[2].code,
      description:
        'Emergency repair required due to Foreign Object Debris (FOD) damage to stand surface.',
      requestedBy: requester.id,
      requestorName: requester.name,
      requestorEmail: requester.email,
      startDate: new Date('2025-01-20'),
      endDate: new Date('2025-01-21'),
      status: 'completed',
      priority: 'urgent',
      impact:
        'Stand closed immediately for safety. Adjacent stands restricted to Code C aircraft only.',
      reviewedBy: assetOwner.id,
      reviewedAt: new Date('2025-01-19'),
      reviewerName: assetOwner.name,
      reviewComments: 'Approved for immediate action due to safety concerns.',
    },
    {
      assetId: stands[3].id,
      assetType: 'stand',
      assetCode: stands[3].code,
      title: 'Lighting System Upgrade - Stand ' + stands[3].code,
      description:
        'Upgrade stand lighting to LED system for improved visibility and energy efficiency.',
      requestedBy: requester.id,
      requestorName: requester.name,
      requestorEmail: requester.email,
      startDate: new Date('2025-03-01'),
      endDate: new Date('2025-03-05'),
      status: 'draft',
      priority: 'low',
      impact: 'Night operations restricted. Day operations continue as normal.',
    },
  ];

  for (const requestData of workRequests) {
    const workRequest = await prisma.workRequest.create({
      data: {
        organizationId: manchesterOrg.id,
        ...requestData,
        createdBy: requester.id,
        updatedBy: requester.id,
      },
    });

    console.log(`✅ Created work request: ${workRequest.title} (${workRequest.status})`);

    // Create status history
    if (requestData.status !== 'draft') {
      await prisma.workRequestStatusHistory.create({
        data: {
          workRequestId: workRequest.id,
          fromStatus: 'draft',
          toStatus: 'submitted',
          changedBy: requester.id,
          changedByName: requester.name,
        },
      });
    }

    if (requestData.status === 'approved' || requestData.status === 'completed') {
      await prisma.workRequestStatusHistory.create({
        data: {
          workRequestId: workRequest.id,
          fromStatus: 'submitted',
          toStatus: 'in_review',
          changedBy: assetOwner.id,
          changedByName: assetOwner.name,
        },
      });

      await prisma.workRequestStatusHistory.create({
        data: {
          workRequestId: workRequest.id,
          fromStatus: 'in_review',
          toStatus: 'approved',
          comments: requestData.reviewComments,
          changedBy: assetOwner.id,
          changedByName: assetOwner.name,
        },
      });
    }

    if (requestData.status === 'completed') {
      await prisma.workRequestStatusHistory.create({
        data: {
          workRequestId: workRequest.id,
          fromStatus: 'approved',
          toStatus: 'completed',
          comments: 'Work completed successfully',
          changedBy: requester.id,
          changedByName: requester.name,
        },
      });
    }

    // Add some comments to approved/completed requests
    if (requestData.status === 'approved' || requestData.status === 'completed') {
      await prisma.workRequestComment.create({
        data: {
          workRequestId: workRequest.id,
          comment: 'Please ensure all safety protocols are followed during the work.',
          commentedBy: assetOwner.id,
          commenterName: assetOwner.name,
          isInternal: false,
        },
      });
    }

    // Create notification records (in real app these would trigger emails)
    if (requestData.status === 'submitted' || requestData.status === 'approved') {
      await prisma.workRequestNotification.create({
        data: {
          workRequestId: workRequest.id,
          recipientId: requestData.status === 'submitted' ? assetOwner.id : requester.id,
          recipientEmail: requestData.status === 'submitted' ? assetOwner.email : requester.email,
          type: requestData.status,
          subject: `Work Request ${requestData.status}: ${workRequest.title}`,
          body: `Your work request has been ${requestData.status}.`,
          sentAt: new Date(),
        },
      });
    }
  }

  console.log('✅ Work module seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await sharedPrisma.$disconnect();
    await assetsPrisma.$disconnect();
  });
