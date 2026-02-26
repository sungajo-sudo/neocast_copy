/**
 * 중앙 더미 데이터 관리
 * 모든 페이지에서 일관된 데이터 사용
 */

// ===== 세션 데이터 =====

export interface Session {
    id: string;
    title: string;
    date: string;
    time: string;
    instructor: string;
    expectedStudents: number;
    actualStudents: number;
    worksheet: string | null;
    status: 'scheduled' | 'in-progress' | 'completed';
    code: string;
}

// Dashboard용 예정/진행중 세션
export const DUMMY_SESSIONS: Session[] = [
    {
        id: '1',
        title: '중등 수학 2-1 이차방정식 문제풀이',
        date: '2026-02-26',
        time: '14:00',
        instructor: '김민수',
        expectedStudents: 20,
        actualStudents: 18,
        worksheet: '이차방정식_문제지.pdf',
        status: 'scheduled',
        code: 'ABC123',
    },
    {
        id: '2',
        title: '고등 영어 독해 - 수능 유형 분석',
        date: '2026-02-26',
        time: '16:00',
        instructor: '이영희',
        expectedStudents: 15,
        actualStudents: 15,
        worksheet: '수능영어_독해.pdf',
        status: 'in-progress',
        code: 'DEF456',
    },
    {
        id: '3',
        title: '중학 과학 화학반응식 정리',
        date: '2026-02-27',
        time: '10:00',
        instructor: '박철수',
        expectedStudents: 25,
        actualStudents: 0,
        worksheet: '화학반응식_정리.pdf',
        status: 'scheduled',
        code: 'GHI789',
    },
    {
        id: '4',
        title: '한국사 근현대사 연표 암기',
        date: '2026-02-27',
        time: '15:00',
        instructor: '최지원',
        expectedStudents: 12,
        actualStudents: 0,
        worksheet: '근현대사_연표.pdf',
        status: 'scheduled',
        code: 'JKL012',
    },
    {
        id: '5',
        title: '국어 문학 - 현대시 감상 및 필기',
        date: '2026-02-28',
        time: '13:00',
        instructor: '정수연',
        expectedStudents: 18,
        actualStudents: 0,
        worksheet: '현대시_작품집.pdf',
        status: 'scheduled',
        code: 'MNO345',
    },
];

// ===== 종료된 세션 데이터 =====

export interface SessionResult {
    roomId: string;
    name: string;
    date: string;
    time: string;
    duration: number; // 분
    participants: number;
}

// Results용 종료된 세션
export const DUMMY_COMPLETED_SESSIONS: SessionResult[] = [
    {
        roomId: 'session-1',
        name: '중등 수학 2-1 이차방정식 문제풀이',
        date: '2026-02-25',
        time: '14:00',
        duration: 60,
        participants: 18,
    },
    {
        roomId: 'session-2',
        name: '고등 영어 독해 - 수능 유형 분석',
        date: '2026-02-24',
        time: '16:00',
        duration: 50,
        participants: 22,
    },
    {
        roomId: 'session-3',
        name: '중학 과학 화학반응식 정리',
        date: '2026-02-23',
        time: '10:00',
        duration: 45,
        participants: 16,
    },
    {
        roomId: 'session-4',
        name: '한국사 근현대사 연표 암기',
        date: '2026-02-22',
        time: '15:00',
        duration: 55,
        participants: 20,
    },
    {
        roomId: 'session-5',
        name: '국어 문학 - 현대시 감상 및 필기',
        date: '2026-02-21',
        time: '13:00',
        duration: 50,
        participants: 19,
    },
];

// ===== 학생 데이터 =====

export interface StudentData {
    id: string;
    name: string;
    activityTime: number; // 분
    participatedPages: number;
    feedbackCount: number;
    hasNoActivity: boolean;
}

// SessionDetail용 학생 목록
export const DUMMY_STUDENTS: StudentData[] = [
    { id: 's1', name: '김민지', activityTime: 45, participatedPages: 8, feedbackCount: 3, hasNoActivity: false },
    { id: 's2', name: '이서준', activityTime: 38, participatedPages: 7, feedbackCount: 2, hasNoActivity: false },
    { id: 's3', name: '박지우', activityTime: 52, participatedPages: 10, feedbackCount: 4, hasNoActivity: false },
    { id: 's4', name: '최수아', activityTime: 0, participatedPages: 0, feedbackCount: 0, hasNoActivity: true },
    { id: 's5', name: '정현우', activityTime: 41, participatedPages: 9, feedbackCount: 3, hasNoActivity: false },
    { id: 's6', name: '강예린', activityTime: 0, participatedPages: 0, feedbackCount: 0, hasNoActivity: true },
    { id: 's7', name: '윤도현', activityTime: 47, participatedPages: 8, feedbackCount: 2, hasNoActivity: false },
    { id: 's8', name: '한소민', activityTime: 44, participatedPages: 9, feedbackCount: 3, hasNoActivity: false },
];
