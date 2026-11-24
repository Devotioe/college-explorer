import { getChatGPTUser } from "../../chatgpt-auth";
import { getCurrentPasswordUser } from "../../../lib/password-auth";

export async function getMapOwnerId() {
  const account = await getCurrentPasswordUser();
  if (account) return `password:${account.id}`;

  // Legacy maps already use the original ChatGPT identity as their owner.
  return (await getChatGPTUser())?.userId ?? null;
}
