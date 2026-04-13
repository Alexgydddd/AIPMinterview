/**
 * 环境日志控制工具
 * 仅在 development 模式下执行日志输出，生产环境保持控制台洁净
 */

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * 开发环境日志输出
 * @param message 日志消息
 * @param optionalParams 其他参数
 */
export function devLog(message?: any, ...optionalParams: any[]): void {
  if (isDevelopment) {
    console.log(message, ...optionalParams);
  }
}

/**
 * 开发环境警告日志
 * @param message 警告消息
 * @param optionalParams 其他参数
 */
export function devWarn(message?: any, ...optionalParams: any[]): void {
  if (isDevelopment) {
    console.warn(message, ...optionalParams);
  }
}

/**
 * 开发环境错误日志
 * @param message 错误消息
 * @param optionalParams 其他参数
 */
export function devError(message?: any, ...optionalParams: any[]): void {
  if (isDevelopment) {
    console.error(message, ...optionalParams);
  }
}

/**
 * 开发环境信息日志
 * @param message 信息消息
 * @param optionalParams 其他参数
 */
export function devInfo(message?: any, ...optionalParams: any[]): void {
  if (isDevelopment) {
    console.info(message, ...optionalParams);
  }
}

/**
 * 开发环境调试日志（带调用栈）
 * @param message 调试消息
 * @param optionalParams 其他参数
 */
export function devDebug(message?: any, ...optionalParams: any[]): void {
  if (isDevelopment) {
    console.debug(message, ...optionalParams);
  }
}
