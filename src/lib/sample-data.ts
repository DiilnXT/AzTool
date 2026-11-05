import { Question, ExamMetadata } from '@/types/exam';

export const SAMPLE_METADATA: ExamMetadata = {
  university: 'TRƯỜNG ĐẠI HỌC CỬU LONG',
  department: 'KHOA CÔNG NGHỆ THÔNG TIN',
  semester: 'I',
  academicYear: '2024-2025',
  subject: 'CƠ SỞ DỮ LIỆU NÂNG CAO',
  subjectNote: 'Hệ Đại học Chính quy',
  durationMinutes: '60',
  examDate: '15',
  examMonth: '12',
  examYear: '2024',
  examCode: '101',
  note: 'Sinh viên KHÔNG được sử dụng tài liệu.',
};

export const SAMPLE_QUESTIONS: Question[] = [
  {
    id: 1,
    originalNumber: 1,
    text: 'Trong hệ quản trị cơ sở dữ liệu quan hệ, thuộc tính hoặc tập thuộc tính dùng để phân biệt duy nhất từng bản ghi được gọi là gì?',
    options: {
      A: 'Khóa ngoại (Foreign Key)',
      B: 'Khóa chính (Primary Key)',
      C: 'Khóa phụ (Candidate Key)',
      D: 'Chỉ mục (Index)',
    },
    correctAnswer: 'B',
  },
  {
    id: 2,
    originalNumber: 2,
    text: 'Lệnh SQL nào sau đây thuộc nhóm DDL (Data Definition Language)?',
    options: {
      A: 'SELECT',
      B: 'INSERT',
      C: 'CREATE TABLE',
      D: 'UPDATE',
    },
    correctAnswer: 'C',
  },
  {
    id: 3,
    originalNumber: 3,
    text: 'Tính chất ACID trong giao dịch (Transaction) của DBMS gồm có:',
    options: {
      A: 'Atomicity, Consistency, Isolation, Durability',
      B: 'Accuracy, Completeness, Integrity, Durability',
      C: 'Atomicity, Concurrency, Isolation, Dependability',
      D: 'Authentication, Confidentiality, Integrity, Digital signature',
    },
    correctAnswer: 'A',
  },
  {
    id: 4,
    originalNumber: 4,
    text: 'Chuẩn 3NF (Third Normal Form) yêu cầu lược đồ quan hệ phải đạt chuẩn 2NF và thỏa mãn điều kiện nào sau đây?',
    options: {
      A: 'Không chứa thuộc tính đa trị',
      B: 'Mọi thuộc tính không khóa đều phụ thuộc đầy đủ vào khóa chính',
      C: 'Không có phụ thuộc hàm bắc cầu giữa các thuộc tính không khóa vào khóa chính',
      D: 'Mọi phụ thuộc hàm X -> Y thì X phải là siêu khóa',
    },
    correctAnswer: 'C',
  },
  {
    id: 5,
    originalNumber: 5,
    text: 'Trong chỉ mục B-Tree, các nút lá chứa điều gì?',
    options: {
      A: 'Con trỏ trỏ đến các nút lá khác và con trỏ dữ liệu thực tế',
      B: 'Chỉ chứa các giá trị khóa làm mốc định tuyến',
      C: 'Tất cả các bản ghi toàn văn không cần con trỏ',
      D: 'Mã băm (Hash code) của từng khối dữ liệu',
    },
    correctAnswer: 'A',
  },
  {
    id: 6,
    originalNumber: 6,
    text: 'Mệnh đề nào trong SQL được dùng để lọc dữ liệu trên các hàm tổng hợp (Aggregate functions như COUNT, SUM, AVG)?',
    options: {
      A: 'WHERE',
      B: 'HAVING',
      C: 'GROUP BY',
      D: 'ORDER BY',
    },
    correctAnswer: 'B',
  },
  {
    id: 7,
    originalNumber: 7,
    text: 'Loại kết nối (JOIN) nào trả về toàn bộ các dòng từ cả hai bảng kể cả khi không tìm thấy kết quả khớp?',
    options: {
      A: 'INNER JOIN',
      B: 'LEFT OUTER JOIN',
      C: 'RIGHT OUTER JOIN',
      D: 'FULL OUTER JOIN',
    },
    correctAnswer: 'D',
  },
  {
    id: 8,
    originalNumber: 8,
    text: 'Cơ chế nào được sử dụng để giải quyết vấn đề tương tranh (Concurrency control) và ngăn chặn deadlock trong DBMS?',
    options: {
      A: 'Two-Phase Locking (2PL)',
      B: 'Bubble Sort',
      C: 'Round Robin',
      D: 'Dijkstra Shortest Path',
    },
    correctAnswer: 'A',
  },
  {
    id: 9,
    originalNumber: 9,
    text: 'Khi thực hiện xóa một bản ghi ở bảng cha mà các bản ghi tương ứng ở bảng con tự động bị xóa theo, ta cần khai báo ràng buộc khóa ngoại với tùy chọn nào?',
    options: {
      A: 'ON DELETE RESTRICT',
      B: 'ON DELETE SET NULL',
      C: 'ON DELETE CASCADE',
      D: 'ON DELETE NO ACTION',
    },
    correctAnswer: 'C',
  },
  {
    id: 10,
    originalNumber: 10,
    text: 'Hệ cơ sở dữ liệu NoSQL dạng Document-Store tiêu biểu nhất hiện nay là:',
    options: {
      A: 'Redis',
      B: 'Neo4j',
      C: 'MongoDB',
      D: 'Apache Cassandra',
    },
    correctAnswer: 'C',
  },
];
