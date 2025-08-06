import prisma from '$lib/prisma';
import { Status } from '@prisma/client';

export async function fetchInterviews(userId: string) {
	return await prisma.interview.findMany({
		where: {
			OR: [{ interviewerId: userId }, { intervieweeId: userId }]
		},
		include: {
			interviewer: { select: { id: true, name: true, email: true } },
			interviewee: { select: { id: true, name: true, email: true } },
			problems: { select: { id: true, title: true, score: true } }
		},
		orderBy: { startTime: 'desc' }
	});
}

export interface CreateInterviewData {
	intervieweeId: string;
	startTime: Date;
	endTime: Date;
	interviewTitle: string;
	interviewDescription: string;
	problems?: Array<{
		title: string;
		description?: string;
		score: number;
	}>;
}

export async function createInterview(interviewerId: string, data: CreateInterviewData) {
	return await prisma.interview.create({
		data: {
			interviewerId,
			intervieweeId: data.intervieweeId,
			startTime: data.startTime,
			endTime: data.endTime,
			status: Status.PENDING,
			interviewTitle: data.interviewTitle,
			interviewDescription: data.interviewDescription,
			interviewScore: 0, // Default score, will be updated after interview
			problems: data.problems ? {
				create: data.problems.map(problem => ({
					title: problem.title,
					description: problem.description,
					score: problem.score
				}))
			} : undefined
		},
		include: {
			interviewer: { select: { id: true, name: true, email: true } },
			interviewee: { select: { id: true, name: true, email: true } },
			problems: { select: { id: true, title: true, score: true } }
		}
	});
}

export async function updateInterviewStatus(interviewId: string, status: Status) {
	return await prisma.interview.update({
		where: { id: interviewId },
		data: { status },
		include: {
			interviewer: { select: { id: true, name: true, email: true } },
			interviewee: { select: { id: true, name: true, email: true } },
			problems: { select: { id: true, title: true, score: true } }
		}
	});
}

export interface UpdateInterviewData {
	intervieweeId?: string;
	startTime?: Date;
	endTime?: Date;
	status?: Status;
	interviewTitle?: string;
	interviewDescription?: string;
	interviewScore?: number;
}

export async function updateInterview(interviewId: string, data: UpdateInterviewData) {
	return await prisma.interview.update({
		where: { id: interviewId },
		data: {
			...(data.intervieweeId && { intervieweeId: data.intervieweeId }),
			...(data.startTime && { startTime: data.startTime }),
			...(data.endTime && { endTime: data.endTime }),
			...(data.status && { status: data.status }),
			...(data.interviewTitle && { interviewTitle: data.interviewTitle }),
			...(data.interviewDescription && { interviewDescription: data.interviewDescription }),
			...(data.interviewScore !== undefined && { interviewScore: data.interviewScore })
		},
		include: {
			interviewer: { select: { id: true, name: true, email: true } },
			interviewee: { select: { id: true, name: true, email: true } },
			problems: { select: { id: true, title: true, score: true } }
		}
	});
}

export async function getInterviewById(interviewId: string) {
	return await prisma.interview.findUnique({
		where: { id: interviewId },
		include: {
			interviewer: { select: { id: true, name: true, email: true } },
			interviewee: { select: { id: true, name: true, email: true } },
			problems: { 
				select: { 
					id: true, 
					title: true, 
					description: true, 
					score: true,
					testCases: { select: { input: true, output: true } }
				} 
			}
		}
	});
}

export async function getAllUsers() {
	return await prisma.user.findMany({
		select: {
			id: true,
			name: true,
			email: true,
			role: true
		}
	});
}
