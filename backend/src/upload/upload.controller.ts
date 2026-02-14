import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import * as path from 'path';
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpeg = require('fluent-ffmpeg');

const ffmpegPath = ffmpegInstaller.path;
ffmpeg.setFfmpegPath(ffmpegPath);

@Controller('upload')
// @UseGuards(JwtAuthGuard)
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor() {
    this.logger.log('UploadController initialized. FFmpeg Path: ' + ffmpegInstaller.path);
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads', { recursive: true });
      this.logger.log('Created uploads directory');
    }
  }

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
          return cb(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return {
      filename: file.filename,
      originalName: file.originalname,
      path: `/uploads/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  @Post('file')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    this.logger.log(`UPLOAD_DEBUG: Received file ${file.originalname} with mimetype ${file.mimetype}`);
    
    const isWebm = file.mimetype === 'audio/webm' || 
                   file.mimetype === 'video/webm' || 
                   file.originalname.toLowerCase().endsWith('.webm');

    if (isWebm) {
        try {
            const inputPath = file.path;
            const parsedPath = path.parse(inputPath);
            const outputPath = path.join(parsedPath.dir, `${parsedPath.name}.ogg`);
            
            this.logger.log(`Attempting to convert WebM to OGG/Opus: ${inputPath} -> ${outputPath}`);
            
            const command = ffmpeg(inputPath);
            
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('FFmpeg conversion timed out after 30 seconds'));
                }, 30000);

                command
                    .format('ogg')
                    .audioCodec('libopus')
                    .audioBitrate('64k')
                    .on('start', (commandLine: string) => {
                        this.logger.log(`FFmpeg: ${commandLine}`);
                    })
                    .on('end', () => {
                        clearTimeout(timeout);
                        this.logger.log('FFmpeg conversion finished successfully');
                        resolve(true);
                    })
                    .on('error', (err: Error) => {
                        clearTimeout(timeout);
                        this.logger.error(`FFmpeg error: ${err.message}`);
                        reject(err);
                    })
                    .save(outputPath);
            });
            
            if (fs.existsSync(outputPath)) {
                 const finalFilename = path.basename(outputPath);
                 const stats = fs.statSync(outputPath);
                 this.logger.log(`Audio convertido para OGG: ${finalFilename} (${stats.size} bytes)`);
                 try { fs.unlinkSync(inputPath); } catch { /* remove webm original */ }
                 return {
                     filename: finalFilename,
                     originalName: file.originalname.replace(/\.webm$/i, '.ogg'),
                     path: `/uploads/${finalFilename}`,
                     size: stats.size,
                     mimetype: 'audio/ogg',
                 };
            } else {
                this.logger.error(`Output file was not created: ${outputPath}`);
            }
        } catch (error) {
            this.logger.error(`Failed to convert WebM to OGG: ${(error as Error).message}`);
            // Fallback: envia o .webm mesmo (WhatsApp pode rejeitar; usuário verá erro no chat)
        }
    }

    return {
      filename: file.filename,
      originalName: file.originalname,
      path: `/uploads/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype,
    };
  }
}
