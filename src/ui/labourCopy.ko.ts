export const LABOUR_COPY = {
  palisadeProclamation: '선포 후 자재가 준비된 성벽 부지에 필요한 만큼만 일꾼을 배정합니다 (최대 40%, 약 30초)',
  stoneProclamation: '선포 후 자재가 준비된 석벽 부지에 필요한 만큼만 일꾼을 배정합니다 (최대 50%, 약 45초)',
  assigned: (workers: number): string => `성벽 공사 인력 ${workers}명`,
} as const;
