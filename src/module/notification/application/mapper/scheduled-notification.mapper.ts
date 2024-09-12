import { ScheduledNotificationEntity } from '../../adapter/persistence/orm/entities/scheduled-notification.entity';
import { NotificationCategory } from '../../domain/enums/notification-category.enum';
import {
  CalendarNotificationData,
  FriendRequestNotificationData,
  SubjectMemoNotificationData,
} from '../../domain/notification';
import {
  CalendarNotificationDto,
  FriendRequestNotificationDto,
  NotificationDto,
  SubjectMemoNotificationDto,
} from '../dto/notification.dto';

export class ScheduledNotificationMapper {
  static toPersistence(
    userId: number,
    deviceTokens: string[],
    category: NotificationCategory,
    dto: NotificationDto,
    scheduledAt: Date,
  ): Omit<
    ScheduledNotificationEntity,
    'id' | 'createdAt' | 'updatedAt' | 'user'
  > {
    switch (category) {
      case NotificationCategory.Calendar:
        const { eventId, eventTitle } = dto as CalendarNotificationDto;
        let title = `캘린더: ${eventTitle}`;

        return {
          userId,
          deviceTokens,
          category,
          pushTitle: title,
          pushData: {
            eventId,
            category,
          },
          notificationTitle: title,
          notificationBody: { eventId } as CalendarNotificationData,
          scheduledAt,
        };

      case NotificationCategory.SubjectMemo:
        const subjectName = (dto as SubjectMemoNotificationDto).subjectName;
        const classEventId = (dto as SubjectMemoNotificationDto).eventId;

        return {
          userId,
          deviceTokens,
          category,
          pushTitle: `나의 수업함: ${subjectName}`,
          pushMessage: '준비물이 있습니다.',
          pushData: {
            eventId: classEventId,
            category,
          },
          notificationTitle: subjectName,
          notificationBody: {
            eventId: classEventId,
          } as SubjectMemoNotificationData,
          notificationMessage: '준비물이 있습니다.',
          scheduledAt,
        };

      case NotificationCategory.FriendRequest:
        const { requestId, requestType, friendName } =
          dto as FriendRequestNotificationDto;
        title =
          requestType === 'sent'
            ? `친구 요청: ${friendName} 님이 친구가 되고 싶어해요!`
            : `친구 요청: ${friendName} 님께 친구 요청을 보냈어요!`;

        return {
          userId,
          deviceTokens,
          category,
          pushTitle: title,
          pushData: {
            requestId,
            requestType,
            category,
          },
          notificationTitle: title,
          notificationBody: {
            requestId,
            requestType,
          } as FriendRequestNotificationData,
          scheduledAt,
        };
    }
  }
}
