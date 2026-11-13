/** Erro de regra de negócio: a mensagem é segura para mostrar ao usuário. */
export class RuleError extends Error {
  status = 400;
}
export class AuthError extends RuleError {
  override status = 401;
}
export class ForbiddenError extends RuleError {
  override status = 403;
}
export class NotFoundError extends RuleError {
  override status = 404;
}
