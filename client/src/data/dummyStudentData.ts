/**
 * 더미 학생 데이터 중앙 관리
 * StudentReportDetail과 PDF 생성에서 동일한 데이터 사용
 */

export interface StudentInfo {
    id: string;
    name: string;
    activityTime: number; // 분
    participatedPages: number;
    feedbackCount: number;
}

export interface Feedback {
    id: string;
    pageNumber: number;
    timestamp: string;
    imageUrl: string;
    comment?: string;
}

export interface PageParticipation {
    pageNumber: number;
    writingTime: number; // 초
    strokeCount: number;
    firstWriteTime: string;
    lastWriteTime: string;
}

// 학생별 상세 데이터 맵
export const STUDENT_DETAIL_DATA: Record<string, {
    info: StudentInfo;
    feedbacks: Feedback[];
    pageParticipation: PageParticipation[];
}> = {
    's1': {
        info: {
            id: 's1',
            name: '김민지',
            activityTime: 45,
            participatedPages: 8,
            feedbackCount: 3,
        },
        feedbacks: [
            {
                id: 'fb1',
                pageNumber: 1,
                timestamp: '14:12',
                imageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="150"%3E%3Crect fill="%23f3f4f6" width="200" height="150"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%236b7280" font-size="14"%3E첨삭 이미지%3C/text%3E%3C/svg%3E',
                comment: '이차방정식 풀이 과정이 명확합니다',
            },
            {
                id: 'fb2',
                pageNumber: 3,
                timestamp: '14:25',
                imageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="150"%3E%3Crect fill="%23f3f4f6" width="200" height="150"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%236b7280" font-size="14"%3E첨삭 이미지%3C/text%3E%3C/svg%3E',
                comment: '근의 공식 적용 시 부호 주의',
            },
            {
                id: 'fb3',
                pageNumber: 5,
                timestamp: '14:38',
                imageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="150"%3E%3Crect fill="%23f3f4f6" width="200" height="150"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%236b7280" font-size="14"%3E첨삭 이미지%3C/text%3E%3C/svg%3E',
            },
        ],
        pageParticipation: [
            { pageNumber: 1, writingTime: 420, strokeCount: 145, firstWriteTime: '14:05', lastWriteTime: '14:12' },
            { pageNumber: 2, writingTime: 380, strokeCount: 132, firstWriteTime: '14:13', lastWriteTime: '14:19' },
            { pageNumber: 3, writingTime: 450, strokeCount: 168, firstWriteTime: '14:20', lastWriteTime: '14:27' },
            { pageNumber: 4, writingTime: 360, strokeCount: 125, firstWriteTime: '14:28', lastWriteTime: '14:34' },
            { pageNumber: 5, writingTime: 520, strokeCount: 189, firstWriteTime: '14:35', lastWriteTime: '14:43' },
            { pageNumber: 6, writingTime: 290, strokeCount: 98, firstWriteTime: '14:44', lastWriteTime: '14:49' },
            { pageNumber: 7, writingTime: 340, strokeCount: 115, firstWriteTime: '14:50', lastWriteTime: '14:55' },
            { pageNumber: 8, writingTime: 180, strokeCount: 62, firstWriteTime: '14:56', lastWriteTime: '14:59' },
        ],
    },
    's2': {
        info: {
            id: 's2',
            name: '이서준',
            activityTime: 38,
            participatedPages: 7,
            feedbackCount: 2,
        },
        feedbacks: [
            {
                id: 'fb1',
                pageNumber: 2,
                timestamp: '14:18',
                imageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="150"%3E%3Crect fill="%23f3f4f6" width="200" height="150"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%236b7280" font-size="14"%3E첨삭 이미지%3C/text%3E%3C/svg%3E',
                comment: '계산 실수를 줄이면 좋겠습니다',
            },
            {
                id: 'fb2',
                pageNumber: 4,
                timestamp: '14:35',
                imageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="150"%3E%3Crect fill="%23f3f4f6" width="200" height="150"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%236b7280" font-size="14"%3E첨삭 이미지%3C/text%3E%3C/svg%3E',
            },
        ],
        pageParticipation: [
            { pageNumber: 1, writingTime: 390, strokeCount: 128, firstWriteTime: '14:05', lastWriteTime: '14:11' },
            { pageNumber: 2, writingTime: 410, strokeCount: 142, firstWriteTime: '14:12', lastWriteTime: '14:19' },
            { pageNumber: 3, writingTime: 360, strokeCount: 119, firstWriteTime: '14:20', lastWriteTime: '14:26' },
            { pageNumber: 4, writingTime: 380, strokeCount: 135, firstWriteTime: '14:27', lastWriteTime: '14:33' },
            { pageNumber: 5, writingTime: 420, strokeCount: 152, firstWriteTime: '14:34', lastWriteTime: '14:41' },
            { pageNumber: 6, writingTime: 310, strokeCount: 105, firstWriteTime: '14:42', lastWriteTime: '14:47' },
            { pageNumber: 7, writingTime: 280, strokeCount: 92, firstWriteTime: '14:48', lastWriteTime: '14:52' },
        ],
    },
    // 나머지 학생들은 기본 데이터로 생성
};

/**
 * 학생 ID로 상세 데이터 가져오기
 * 데이터가 없으면 자동 생성
 */
export const getStudentDetailData = (studentId: string, studentName: string, participatedPages: number) => {
    // 미리 정의된 데이터가 있으면 반환
    if (STUDENT_DETAIL_DATA[studentId]) {
        return STUDENT_DETAIL_DATA[studentId];
    }

    // 없으면 자동 생성
    const pageParticipation: PageParticipation[] = Array.from({ length: participatedPages }, (_, i) => {
        const pageNum = i + 1;
        const baseTime = 300 + Math.floor(Math.random() * 200);
        const baseStrokes = 100 + Math.floor(Math.random() * 100);

        return {
            pageNumber: pageNum,
            writingTime: baseTime,
            strokeCount: baseStrokes,
            firstWriteTime: `14:${(5 + i * 7).toString().padStart(2, '0')}`,
            lastWriteTime: `14:${(12 + i * 7).toString().padStart(2, '0')}`,
        };
    });

    return {
        info: {
            id: studentId,
            name: studentName,
            activityTime: Math.round(pageParticipation.reduce((sum, p) => sum + p.writingTime, 0) / 60),
            participatedPages,
            feedbackCount: 0,
        },
        feedbacks: [],
        pageParticipation,
    };
};
