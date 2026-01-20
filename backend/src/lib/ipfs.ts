import axios from 'axios';
import FormData from 'form-data';

// Pinata V3 API uses different upload endpoint
const PINATA_UPLOAD_URL = 'https://uploads.pinata.cloud/v3/files';

export async function uploadToIPFS(
  data: Buffer,
  filename: string
): Promise<{ cid: string; size: number }> {
  const PINATA_JWT = process.env.PINATA_JWT;

  if (!PINATA_JWT) {
    throw new Error('PINATA_JWT not configured');
  }

  const formData = new FormData();
  formData.append('file', data, filename);
  formData.append('network', 'public'); // Required for V3 API

  const response = await axios.post(
    PINATA_UPLOAD_URL,
    formData,
    {
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`,
        ...formData.getHeaders()
      },
      maxBodyLength: Infinity
    }
  );

  // V3 API response structure: { data: { id, cid, name, size, ... } }
  return {
    cid: response.data.data.cid,
    size: response.data.data.size
  };
}

export async function retrieveFromIPFS(cid: string): Promise<Buffer> {
  const PINATA_GATEWAY = process.env.PINATA_GATEWAY;

  if (!PINATA_GATEWAY) {
    throw new Error('PINATA_GATEWAY not configured');
  }

  const response = await axios.get(`${PINATA_GATEWAY}/ipfs/${cid}`, {
    responseType: 'arraybuffer'
  });
  return Buffer.from(response.data);
}
