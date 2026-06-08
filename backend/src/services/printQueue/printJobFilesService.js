import { executor } from '../../db/repository.js';

export async function createPrintJobFilesForOrder({ printJobId, orderFiles, client }) {
  if (!orderFiles || orderFiles.length === 0) return [];

  const jobFiles = orderFiles.map(orderFile => mapOrderFileToPrintJobFile({ printJobId, orderFile }));

  // Create bulk insert
  const values = [];
  const placeholders = [];
  
  jobFiles.forEach((file, index) => {
    const offset = index * 8;
    placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`);
    values.push(
      file.printJobId,
      file.orderFileId || null,
      file.documentId || null,
      file.fileSha256 || null,
      file.fileType || 'application/pdf',
      file.copies || 1,
      file.printOptions ? JSON.stringify(file.printOptions) : '{}',
      file.printSequence || 0
    );
  });

  const query = `
    INSERT INTO print_job_files (
      print_job_id,
      order_file_id,
      document_id,
      file_sha256,
      file_type,
      copies,
      print_options,
      print_sequence
    )
    VALUES ${placeholders.join(', ')}
    RETURNING *;
  `;

  const result = await executor(client).query(query, values);
  return result.rows;
}

export async function getPrintJobFiles(printJobId, client) {
  const result = await executor(client).query(
    `SELECT * FROM print_job_files WHERE print_job_id = $1 ORDER BY print_sequence ASC`,
    [printJobId]
  );
  return result.rows;
}

function mapOrderFileToPrintJobFile({ printJobId, orderFile }) {
  return {
    printJobId,
    orderFileId: orderFile.id,
    documentId: orderFile.document?.id || orderFile.documentId,
    fileSha256: orderFile.document?.fileSha256 || null,
    fileType: orderFile.document?.fileType || 'application/pdf',
    copies: orderFile.copies,
    printOptions: orderFile.printOptions || {},
    printSequence: orderFile.printSequence || 0
  };
}
