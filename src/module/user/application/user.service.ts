// inbound port

import { FindUniqueUserQuery } from './dto/user.query';
import { UserRepository } from './port/user.repository.abstract';
import { Inject } from '@nestjs/common';
import { UserEntity } from '../adapter/persistence/orm/entities/user.entity';
import { UserMapper } from '../adapter/presenter/rest/mappers/user.mapper';
import { User } from './../domain/user';
import { UpdateProfileRequest } from '../adapter/presenter/rest/dto/user.dto';
import { SchoolRepository } from 'src/module/school-dataset/application/port/school.repository.abstract';
import { ClassRepository } from 'src/module/school-dataset/application/port/class.repository.abstract';
import { UserStatus } from '../domain/enum/user-status.enum';
import { ObjectStorageService } from 'src/module/object-storage/application/object-storage.service.abstract';
import { StorageCategory } from 'src/module/object-storage/domain/enums/storage-category.enum';
import { SupportedEnvironment } from 'src/config/environment/environment';
import { MissingRequiredFieldsError } from 'src/common/types/error/application-exceptions';
import { CalendarService } from 'src/module/calendar/application/calendar.service';
import { TimetableService } from 'src/module/timetable/application/timetable.service';
import { EnvironmentService } from 'src/config/environment/environment.service';
import { PROFILE_IMAGE_FIELDS } from '../adapter/presenter/rest/constants/profile-image.constants';
import { Transactional } from 'typeorm-transactional';
import { SignInProvider } from 'src/module/iam/domain/enums/sign-in-provider.enum';
import { ReportProvider } from 'src/common/provider/report.provider';
import { UserGrade } from 'src/module/school-dataset/domain/value-objects/grade';

export class UserService {
  constructor(
    @Inject(UserRepository)
    private readonly userRepository: UserRepository,
    private readonly schoolRepository: SchoolRepository,
    private readonly classRepository: ClassRepository,
    private readonly objectStorageService: ObjectStorageService,
    private readonly environmentService: EnvironmentService,
    private readonly timetableService: TimetableService,
    private readonly calendarService: CalendarService,
  ) {}

  async insertTestUser(schoolId: number) {
    const userNames = [
      '고등어',
      '도미',
      '연어',
      '참치',
      '다랑어',
      '금붕어',
      '가자미',
      '도다리',
      '갈치',
      '광어',
      '꽁치',
      '꼴뚜기',
      '해삼',
      '전어',
      '전갱이',
      '조기',
      '쥐포',
      '쥐치',
      '쪽파',
      '참다랑어',
    ];

    const classId = (await this.classRepository.findBySchoolId(schoolId))[0].id;

    for (const name of userNames) {
      const providerUserId = Math.floor(Math.random() * 1000000).toString();
      await this.userRepository.insertOne({
        provider: SignInProvider.KAKAO,
        providerUserId,
        status: UserStatus.ACTIVE,
      });

      const user = await this.userRepository.findOneByProvider(
        SignInProvider.KAKAO,
        providerUserId,
      );

      await this.userRepository.upsertProfile({
        userId: user!.id,
        fullName: name,
        classId,
      });
    }
  }

  async findUserByProviderId(
    findUniqueUserDto: FindUniqueUserQuery,
  ): Promise<UserEntity | null> {
    return await this.userRepository.findOneByProvider(
      findUniqueUserDto.provider,
      findUniqueUserDto.providerUserId,
    );
  }

  async getUserProfile(userId: number): Promise<User> {
    return UserMapper.toDomain(
      await this.userRepository.findOneByIdOrFail(userId),
    );
  }

  async upsertProfileImage(
    userId: number,
    file: Express.Multer.File,
    category: StorageCategory,
  ): Promise<string> {
    const uploadParams = {
      uniqueKey: userId,
      file,
      category,
      environment: this.environmentService.get<SupportedEnvironment>('ENV')!,
    };
    const newImgUrl = await this.objectStorageService.uploadFile(uploadParams);

    const user = await this.userRepository.findOneByIdOrFail(userId);
    if (user.profile?.profileImageUrl) {
      await this.objectStorageService.deleteFile({
        objectUrl: user.profile.profileImageUrl,
      });
    }

    return newImgUrl;
  }

  // TODO: 학교 정보 변경시, 기존 시간표, 캘린더 이벤트 삭제
  @Transactional()
  async updateProfile(
    user: UserEntity,
    params: UpdateProfileRequest,
    files: {
      [PROFILE_IMAGE_FIELDS.PROFILE]?: Express.Multer.File[];
      [PROFILE_IMAGE_FIELDS.BACKGROUND]?: Express.Multer.File[];
    },
  ): Promise<User> {
    const {
      schoolId,
      grade,
      className,
      fullName,
      isTimetablePublic,
      isClassPublic,
    } = params;
    await this.schoolRepository.findByIdOrFail(schoolId);
    const hasPartialData = schoolId || className || grade;
    if (hasPartialData && (!schoolId || !className || !grade)) {
      throw new MissingRequiredFieldsError(['schoolId', 'className', 'grade']);
    }

    let classId: number | undefined;

    if (schoolId && className && grade) {
      classId = (
        await this.classRepository.findByNameAndGradeOrFail(
          schoolId,
          className,
          grade,
        )
      ).id;
    }

    const profileImageFile = files?.[PROFILE_IMAGE_FIELDS?.PROFILE]?.[0];
    const backgroundImageFile = files?.[PROFILE_IMAGE_FIELDS?.BACKGROUND]?.[0];

    let profileImageUrl: string | undefined;
    let backgroundImageUrl: string | undefined;
    if (profileImageFile) {
      profileImageUrl = await this.upsertProfileImage(
        user.id,
        profileImageFile,
        StorageCategory.USER_PROFILES,
      );
    }

    if (backgroundImageFile) {
      backgroundImageUrl = await this.upsertProfileImage(
        user.id,
        backgroundImageFile,
        StorageCategory.USER_BACKGROUNDS,
      );
    }

    await this.userRepository.upsertProfile({
      userId: user.id,
      fullName: fullName ?? user.profile?.fullName,
      classId:
        classId !== null && classId !== undefined
          ? classId
          : user.profile?.classId,
      isClassPublic:
        isClassPublic !== undefined
          ? isClassPublic
          : user.profile?.isClassPublic,
      isTimetablePublic:
        isTimetablePublic !== undefined
          ? isTimetablePublic
          : user.profile?.isTimetablePublic,
      profileImageUrl: profileImageUrl ?? user.profile?.profileImageUrl,
      backgroundImageUrl:
        backgroundImageUrl ?? user.profile?.backgroundImageUrl,
    });

    const updatedUser = await this.userRepository.findOneByIdOrFail(user.id);

    // 필수 정보가 모두 입력되었을 때만 유저 상태 변경
    if (
      updatedUser.profile?.classId !== null &&
      updatedUser.profile?.classId != undefined &&
      updatedUser.profile?.fullName
    ) {
      await this.userRepository.updateOne({
        id: user.id,
        status: UserStatus.ACTIVE,
      });
    }

    if (classId) {
      this.setDefaultTimetableAndCalendarEvents(
        user.id,
        schoolId,
        classId,
        grade,
      ).catch((error) => {
        ReportProvider.warn(error, {
          describe: '기본 시간표, 캘린더 이벤트 설정 실패',
          userInfo: user,
        });
      });
    }

    return UserMapper.toDomain(
      await this.userRepository.findOneByIdOrFail(user.id),
    );
  }

  private async setDefaultTimetableAndCalendarEvents(
    userId: number,
    schoolId: number,
    classId: number,
    grade: UserGrade,
  ) {
    await Promise.all([
      this.timetableService.setUserDefaultTimetableWithFallbackFetch(
        userId,
        classId,
      ),
      this.calendarService.setUserSchoolEventsWithFallbackFetch(
        userId,
        schoolId,
        grade,
      ),
    ]);
  }

  async delete(user: UserEntity): Promise<void> {
    try {
      if (user.profile?.profileImageUrl) {
        await this.deleteProfileImage({
          id: user.id,
          profileImageUrl: user.profile!.profileImageUrl!,
        });
      }

      if (user.profile?.backgroundImageUrl) {
        await this.deleteProfileBackgroundImage({
          id: user.id,
          backgroundImageUrl: user.profile!.backgroundImageUrl!,
        });
      }
    } catch (error: any) {
      ReportProvider.warn(error, {
        describe: '탈퇴 회원 이미지 삭제 실패',
        userInfo: user,
      });
    }

    try {
      await this.userRepository.insertLogDeletedUser(user);
    } catch (error: any) {
      ReportProvider.warn(error, { describe: '탈퇴 로그 저장 실패' });
    }

    await this.userRepository.deleteOne(user.id);
  }

  async deleteProfileImage(
    params: Pick<User, 'id' | 'profileImageUrl'>,
  ): Promise<void> {
    await this.objectStorageService.deleteFile({
      objectUrl: params.profileImageUrl,
    });
    await this.userRepository.updateProfile(params.id, {
      profileImageUrl: null,
    });
  }

  async deleteProfileBackgroundImage(
    params: Pick<User, 'id' | 'backgroundImageUrl'>,
  ): Promise<void> {
    await this.objectStorageService.deleteFile({
      objectUrl: params.backgroundImageUrl,
    });

    await this.userRepository.updateProfile(params.id, {
      backgroundImageUrl: null,
    });
  }
}
