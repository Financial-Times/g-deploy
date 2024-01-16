/**
 * @file
 * Gets AWS keys from Vault
 */

import axios from "axios";

export default async function getAwsKeys(
  roleId: string,
  secretId: string,
  endpoint: string,
  secretPath: string
) {
  try {
    const { data } = await axios.post(`${endpoint}/v1/auth/approle/login`, {
      role_id: roleId,
      secret_id: secretId,
    });

    const token = data.auth.client_token;

    return (
      await axios.get(`${endpoint}/v1/${secretPath}`, {
        headers: {
          "X-Vault-Token": token,
        },
      })
    ).data;
  } catch (e) {
    throw e;
  }
}
