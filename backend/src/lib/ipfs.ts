import axios from 'axios';
import FormData from 'form-data';

const PINATA_API_URL = 'https://api.pinata.cloud';

export async function uploadToIPFS(
  data: Buffer,
  filename: string
): Promise<{ cid: string; size: number }> {
  const PINATA_JWT = process.env.PINATA_JWT;
  const PINATA_GATEWAY = process.env.PINATA_GATEWAY;

  if (!PINATA_JWT) {
    throw new Error('PINATA_JWT not configured');
  }

  const formData = new FormData();
  formData.append('file', data, filename);

  const response = await axios.post(
    `${PINATA_API_URL}/pinning/pinFileToIPFS`,
    formData,
    {
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`,
        ...formData.getHeaders()
      },
      maxBodyLength: Infinity
    }
  );

  return {
    cid: response.data.IpfsHash,
    size: response.data.PinSize
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
