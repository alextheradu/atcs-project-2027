-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'INCOMING', 'COUNSELOR', 'SUPERVISOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "Cohort" AS ENUM ('CURRENT', 'INCOMING_8');

-- CreateEnum
CREATE TYPE "Department" AS ENUM ('ENGLISH', 'SOCIAL_STUDIES', 'MATH', 'COMPUTER_SCIENCE', 'SCIENCE', 'WORLD_LANGUAGE', 'ART', 'BUSINESS', 'FAMILY_CONSUMER_SCIENCES', 'HEALTH_PE', 'MUSIC', 'TECHNOLOGY', 'SPECIAL_ED', 'OTHER');

-- CreateEnum
CREATE TYPE "Level" AS ENUM ('CP', 'ENHANCED', 'HONORS', 'AP', 'DUAL_ENROLLMENT', 'MIDDLE_SCHOOL');

-- CreateEnum
CREATE TYPE "Duration" AS ENUM ('FULL', 'HALF');

-- CreateEnum
CREATE TYPE "RequirementKind" AS ENUM ('ENGLISH', 'MATH', 'SCI_BIO', 'SCI_CHEM', 'SCI_PHYS', 'SOCIAL_STUDIES', 'ARTS', 'LIFE_CAREERS', 'FIN_LIT', 'WORLD_LANG', 'PE_HEALTH');

-- CreateEnum
CREATE TYPE "Track" AS ENUM ('MATH', 'SCIENCE', 'COMPUTER_SCIENCE', 'WORLD_LANGUAGE', 'ENGLISH', 'SOCIAL_STUDIES', 'OTHER');

-- CreateEnum
CREATE TYPE "EdgeKind" AS ENUM ('STANDARD', 'ADVANCE');

-- CreateEnum
CREATE TYPE "LetterGrade" AS ENUM ('A_PLUS', 'A', 'A_MINUS', 'B_PLUS', 'B', 'B_MINUS', 'C_PLUS', 'C', 'C_MINUS', 'D_PLUS', 'D', 'F', 'PASS');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EntrySource" AS ENUM ('MANUAL', 'IMPORT', 'STARTER');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DENIED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('TEXT', 'LONG_TEXT', 'NUMBER', 'YES_NO', 'CHOICE');

-- CreateEnum
CREATE TYPE "TimelineKind" AS ENUM ('GRADES_DUE', 'COURSE_SELECTION', 'APPEAL_WINDOW', 'APPEAL_DECISIONS', 'OTHER');

-- CreateEnum
CREATE TYPE "Audience" AS ENUM ('CURRENT', 'INCOMING', 'ALL');

-- CreateEnum
CREATE TYPE "EighthMath" AS ENUM ('ALGEBRA_I', 'PRE_ALGEBRA', 'UNSURE');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('APPEAL_SUBMITTED', 'APPEAL_ASSIGNED', 'APPEAL_DECIDED', 'PLAN_SUBMITTED', 'PLAN_CHANGES_REQUESTED', 'PLAN_APPROVED', 'PLAN_COMMENT', 'ROLE_CHANGED', 'DELETION_CONFIRM', 'DELETION_SCHEDULED', 'TIMELINE_REMINDER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "DeletionStatus" AS ENUM ('AWAITING_CONFIRMATION', 'SCHEDULED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PolicyKind" AS ENUM ('PRIVACY', 'TERMS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "departments" "Department"[],
    "ageConfirmed13At" TIMESTAMP(3),
    "onboardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "LinkedEmail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkedEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleGrant" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "departments" "Department"[],
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "RoleGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllowedDomain" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "cohort" "Cohort" NOT NULL,
    "label" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AllowedDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "PolicyDocument" (
    "id" TEXT NOT NULL,
    "kind" "PolicyKind" NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "bodyMd" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 0,
    "draft" JSONB NOT NULL DEFAULT '{}',
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cohort" "Cohort" NOT NULL,
    "gradYear" INTEGER,
    "currentGrade" INTEGER,
    "intendedMajor" TEXT,
    "eighthMath" "EighthMath",
    "eighthMathGrade" "LetterGrade",
    "scienceGrade" "LetterGrade",
    "englishGrade" "LetterGrade",
    "historyGrade" "LetterGrade",
    "languageStudied" TEXT,
    "languageLevel" INTEGER,
    "selfReported" BOOLEAN NOT NULL DEFAULT true,
    "honestyConfirmedAt" TIMESTAMP(3),
    "snapshotExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterestTag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "InterestTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" "Department" NOT NULL,
    "level" "Level" NOT NULL,
    "duration" "Duration" NOT NULL,
    "credits" DECIMAL(4,1) NOT NULL,
    "gradesOffered" INTEGER[],
    "description" TEXT NOT NULL DEFAULT '',
    "prereqText" TEXT,
    "rules" JSONB,
    "dualEnrollmentNote" TEXT,
    "hasApExam" BOOLEAN NOT NULL DEFAULT false,
    "plannable" BOOLEAN NOT NULL DEFAULT true,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "sourcePage" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementRule" (
    "kind" "RequirementKind" NOT NULL,
    "label" TEXT NOT NULL,
    "requiredCredits" DECIMAL(5,1) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "RequirementRule_pkey" PRIMARY KEY ("kind")
);

-- CreateTable
CREATE TABLE "CourseRequirement" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "kind" "RequirementKind" NOT NULL,
    "credits" DECIMAL(4,1) NOT NULL,
    "provisional" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CourseRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseAlias" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseEdge" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "track" "Track" NOT NULL,
    "kind" "EdgeKind" NOT NULL DEFAULT 'STANDARD',
    "appealable" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,

    CONSTRAINT "CourseEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewerId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanEntry" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "gradeLevel" INTEGER NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'PLANNED',
    "grade" "LetterGrade",
    "credits" DECIMAL(4,1) NOT NULL,
    "source" "EntrySource" NOT NULL DEFAULT 'MANUAL',
    "overrideAppealId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanComment" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "entryId" TEXT,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL,
    "kind" "TimelineKind" NOT NULL,
    "audience" "Audience" NOT NULL DEFAULT 'ALL',
    "label" TEXT NOT NULL,
    "schoolYear" TEXT NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppealQuestion" (
    "id" TEXT NOT NULL,
    "department" "Department",
    "prompt" TEXT NOT NULL,
    "helpText" TEXT,
    "type" "QuestionType" NOT NULL DEFAULT 'LONG_TEXT',
    "options" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AppealQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appeal" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "targetCourseId" TEXT NOT NULL,
    "currentCourseId" TEXT,
    "department" "Department" NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'DRAFT',
    "reportedGrade" "LetterGrade",
    "reportedAverage" DECIMAL(5,2),
    "selfReported" BOOLEAN NOT NULL DEFAULT true,
    "unmetRules" JSONB NOT NULL DEFAULT '[]',
    "windowId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppealAnswer" (
    "id" TEXT NOT NULL,
    "appealId" TEXT NOT NULL,
    "questionId" TEXT,
    "prompt" TEXT NOT NULL,
    "answer" TEXT NOT NULL,

    CONSTRAINT "AppealAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT true,
    "push" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeletionRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "emailHash" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'self',
    "status" "DeletionStatus" NOT NULL DEFAULT 'AWAITING_CONFIRMATION',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorLabel" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_StudentInterests" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_StudentInterests_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_CourseInterests" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CourseInterests_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "LinkedEmail_email_key" ON "LinkedEmail"("email");

-- CreateIndex
CREATE INDEX "LinkedEmail_userId_idx" ON "LinkedEmail"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleGrant_email_key" ON "RoleGrant"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AllowedDomain_domain_key" ON "AllowedDomain"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyDocument_kind_version_key" ON "PolicyDocument"("kind", "version");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyAcceptance_userId_documentId_key" ON "PolicyAcceptance"("userId", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingProgress_userId_key" ON "OnboardingProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InterestTag_slug_key" ON "InterestTag"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");

-- CreateIndex
CREATE INDEX "Course_department_level_idx" ON "Course"("department", "level");

-- CreateIndex
CREATE INDEX "Course_archived_idx" ON "Course"("archived");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRequirement_courseId_kind_key" ON "CourseRequirement"("courseId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "CourseAlias_alias_key" ON "CourseAlias"("alias");

-- CreateIndex
CREATE INDEX "CourseAlias_courseId_idx" ON "CourseAlias"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseEdge_fromId_toId_key" ON "CourseEdge"("fromId", "toId");

-- CreateIndex
CREATE INDEX "Plan_ownerId_idx" ON "Plan"("ownerId");

-- CreateIndex
CREATE INDEX "PlanEntry_planId_gradeLevel_idx" ON "PlanEntry"("planId", "gradeLevel");

-- CreateIndex
CREATE UNIQUE INDEX "PlanEntry_planId_courseId_key" ON "PlanEntry"("planId", "courseId");

-- CreateIndex
CREATE INDEX "PlanComment_planId_idx" ON "PlanComment"("planId");

-- CreateIndex
CREATE INDEX "TimelineEvent_kind_audience_opensAt_idx" ON "TimelineEvent"("kind", "audience", "opensAt");

-- CreateIndex
CREATE INDEX "Appeal_studentId_idx" ON "Appeal"("studentId");

-- CreateIndex
CREATE INDEX "Appeal_department_status_idx" ON "Appeal"("department", "status");

-- CreateIndex
CREATE INDEX "AppealAnswer_appealId_idx" ON "AppealAnswer"("appealId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_nextAttemptAt_idx" ON "NotificationDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_kind_key" ON "NotificationPreference"("userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "DeletionRequest_status_scheduledFor_idx" ON "DeletionRequest"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "_StudentInterests_B_index" ON "_StudentInterests"("B");

-- CreateIndex
CREATE INDEX "_CourseInterests_B_index" ON "_CourseInterests"("B");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedEmail" ADD CONSTRAINT "LinkedEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleGrant" ADD CONSTRAINT "RoleGrant_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyAcceptance" ADD CONSTRAINT "PolicyAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyAcceptance" ADD CONSTRAINT "PolicyAcceptance_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PolicyDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingProgress" ADD CONSTRAINT "OnboardingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRequirement" ADD CONSTRAINT "CourseRequirement_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAlias" ADD CONSTRAINT "CourseAlias_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAlias" ADD CONSTRAINT "CourseAlias_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEdge" ADD CONSTRAINT "CourseEdge_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEdge" ADD CONSTRAINT "CourseEdge_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEntry" ADD CONSTRAINT "PlanEntry_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEntry" ADD CONSTRAINT "PlanEntry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEntry" ADD CONSTRAINT "PlanEntry_overrideAppealId_fkey" FOREIGN KEY ("overrideAppealId") REFERENCES "Appeal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanComment" ADD CONSTRAINT "PlanComment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanComment" ADD CONSTRAINT "PlanComment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "PlanEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanComment" ADD CONSTRAINT "PlanComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_targetCourseId_fkey" FOREIGN KEY ("targetCourseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_currentCourseId_fkey" FOREIGN KEY ("currentCourseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "TimelineEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppealAnswer" ADD CONSTRAINT "AppealAnswer_appealId_fkey" FOREIGN KEY ("appealId") REFERENCES "Appeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppealAnswer" ADD CONSTRAINT "AppealAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AppealQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeletionRequest" ADD CONSTRAINT "DeletionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StudentInterests" ADD CONSTRAINT "_StudentInterests_A_fkey" FOREIGN KEY ("A") REFERENCES "InterestTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StudentInterests" ADD CONSTRAINT "_StudentInterests_B_fkey" FOREIGN KEY ("B") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CourseInterests" ADD CONSTRAINT "_CourseInterests_A_fkey" FOREIGN KEY ("A") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CourseInterests" ADD CONSTRAINT "_CourseInterests_B_fkey" FOREIGN KEY ("B") REFERENCES "InterestTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One primary plan per user
CREATE UNIQUE INDEX "one_primary_plan_per_user" ON "Plan"("ownerId") WHERE "isPrimary";
