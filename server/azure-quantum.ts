import axios from 'axios';
import crypto from 'crypto';

interface QuantumConfig {
  endpoint: string;
  apiKey: string;
  workspaceId: string;
}

// Default quantum configuration using environment variables
const quantumConfig: QuantumConfig = {
  endpoint: process.env.AZURE_QUANTUM_ENDPOINT || 'https://quantum.azure.com',
  apiKey: process.env.AZURE_QUANTUM_API_KEY || 'your-quantum-api-key',
  workspaceId: process.env.AZURE_QUANTUM_WORKSPACE_ID || 'your-workspace-id'
};

/**
 * Generates random numbers using Azure Quantum's random number generator.
 * Falls back to a quantum-inspired pseudorandom number generator if the service is unavailable.
 * 
 * @param numBytes - Number of random bytes to generate
 * @returns Promise resolving to a Buffer containing random bytes
 */
const HAS_LIVE_QUANTUM_KEY = quantumConfig.apiKey !== 'your-quantum-api-key';

export async function generateQuantumRandomBytes(numBytes: number): Promise<Buffer> {
  // No live Azure Quantum credentials on the public demo deployment - skip
  // straight to the local fallback rather than waiting out a network call
  // that's guaranteed to fail (and would eat into a serverless function's
  // time budget for no benefit).
  if (!HAS_LIVE_QUANTUM_KEY) {
    return generateQuantumInspiredRandomBytes(numBytes);
  }
  try {
    const response = await axios({
      method: 'post',
      url: `${quantumConfig.endpoint}/quantum/${quantumConfig.workspaceId}/random-number-generators/qrng`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${quantumConfig.apiKey}`
      },
      data: {
        count: numBytes,
        outputType: 'base64'
      }
    });

    if (response.status === 200 && response.data && response.data.value) {
      return Buffer.from(response.data.value, 'base64');
    }
    
    throw new Error('Invalid response from Azure Quantum service');
  } catch (error) {
    console.warn('Failed to get quantum random numbers, falling back to quantum-inspired alternative:', error);
    return generateQuantumInspiredRandomBytes(numBytes);
  }
}

/**
 * Generates quantum-inspired random bytes when the quantum service is unavailable.
 * This uses a more complex entropy pool than standard pseudorandom generators.
 * 
 * @param numBytes - Number of random bytes to generate
 * @returns Buffer containing quantum-inspired random bytes
 */
function generateQuantumInspiredRandomBytes(numBytes: number): Buffer {
  // Create multiple sources of entropy
  const timestamp = Date.now().toString();
  const randomValues = crypto.randomBytes(numBytes * 2).toString('hex');
  const nodeRandomValue = Math.random().toString();
  
  // Combine entropy sources
  const entropySource = timestamp + randomValues + nodeRandomValue;
  
  // Apply mixing function (simulate quantum superposition)
  let mixedEntropy = '';
  for (let i = 0; i < entropySource.length; i++) {
    // XOR with position to simulate quantum interference
    const charCode = entropySource.charCodeAt(i) ^ (i % 256);
    mixedEntropy += String.fromCharCode(charCode % 256);
  }
  
  // Create a SHA-512 hash (compression function)
  const hash = crypto.createHash('sha512').update(mixedEntropy).digest();
  
  // Return the appropriate number of bytes
  return Buffer.from(hash.slice(0, numBytes));
}

/**
 * Generates a cryptographic key using quantum random numbers
 * 
 * @param keySizeBytes - Size of the key in bytes
 * @returns Promise resolving to a Buffer containing the key
 */
export async function generateQuantumKey(keySizeBytes: number = 32): Promise<Buffer> {
  return generateQuantumRandomBytes(keySizeBytes);
}

/**
 * Generates a secure random string for use as a password or salt
 * 
 * @param length - Length of the string to generate
 * @returns Promise resolving to a secure random string
 */
export async function generateSecureRandomString(length: number = 32): Promise<string> {
  const randomBytes = await generateQuantumRandomBytes(Math.ceil(length * 3 / 4));
  return randomBytes.toString('base64').slice(0, length);
}
