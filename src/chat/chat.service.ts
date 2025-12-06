import { Injectable } from '@nestjs/common';
import { IncomingMessageDto } from './dto/incoming-message.dto';
// import { UpdateChatDto } from './dto/update-chat.dto';
import { InjectModel } from '@nestjs/mongoose';
import { HttpService } from '@nestjs/axios';
import { FreeSlotService } from 'src/free-slot/free-slot.service';
import { SessionService } from 'src/session/session.service';
import { EncryptionService } from 'src/encryption/encryption.service';
import { ConversationReply } from './dto/conversation-reply.dto';
import { TelegramMessageDto } from './dto/telegram-message.dto';
import { ISession, TenantVisitorStatus } from 'src/session/entities/session.interface';
import dialogsConfig from './dialogs.config'
import { lastValueFrom } from 'rxjs';
import { AuthService } from 'src/auth/auth.service';
import { DialogConfig } from './dto/dialog-config.dto';
@Injectable()
export class ChatService {
  constructor(
    private readonly httpService: HttpService,
    private readonly authService: AuthService,  
    // private readonly freeSlotService: FreeSlotService,
    private readonly sessionService: SessionService,
    // private readonly encryptionService: EncryptionService
  ) {}
  async sendMessage(reply: ConversationReply) {
    console.log({ reply });
    const url = 'https://hook.us2.make.com/pmj3fg7g4r8ixh973byxnwjhd67vezqu';
    console.log('sending message');
    const response = await lastValueFrom(this.httpService.post(url, { reply }));
    console.log('Message sent:', response.data);
  }

  handleNewOrRecurrentLead(newSession: ISession) {
  }

  parseDialogToConversationReply(dialog: any, leadId: string): ConversationReply {
    console.log('Parsing dialog to conversation reply:', dialog);
    let replyOptions: string[] = [];
    if (dialog.replyOptions && !Array.isArray(dialog.replyOptions)) {
      replyOptions = Object.entries(dialog.replyOptions).map(([key, value]) => `${key}:${value}`);
    }
    const result: ConversationReply = {
      text: dialog.message ,
      sender: 'bot',
      timestamp: new Date().toISOString(),
      replyOptions: replyOptions,
      leadId: leadId, // Include leadId in the reply
    };
    return result;
  }

  getErrorReply(leadId: string): ConversationReply {
    const result: ConversationReply = {
      text: 'Sorry, something went wrong.',
      sender: 'bot',
      timestamp: new Date().toISOString(),
      replyOptions: [],
      leadId: leadId, // Include leadId in the reply
    };
    return result
  }
  async readMessage(incomingMessageDto: TelegramMessageDto) {
    const leadId = incomingMessageDto.chat.id.toString();
    this.sessionService.findByLeadId(leadId)
      .then(async (session) => {

        if (!session || session.tenantVisitorStatus === TenantVisitorStatus.PROCESSED) {
          // If no existing session or the session is from recurring lead, then create a new session
          if (session) {
            session = await this.authService.deleteToken(leadId);
            console.log('Previous session from recurrent lead has been set to stale:', session);
          }

          try {
            const newSession = await this.sessionService.createLeadSession(leadId);
            console.log('New session created:', newSession);
            const greetingDialog = this.getNextDialog(newSession, incomingMessageDto.text);
            console.log('Greeting dialog:', greetingDialog);
            const greetingReply: ConversationReply = this.parseDialogToConversationReply(greetingDialog, leadId);
            await this.sendMessage(greetingReply);
          } catch (error) {
            console.error('Error creating new session:', error);
            await this.sendMessage(this.getErrorReply(leadId));
          }
        } else if (session && session.tenantVisitorStatus === TenantVisitorStatus.PROCESSING) {
          // Fix: Use an async IIFE to allow await inside the .then() callback
          (async () => {
            console.log('Existing session found:', session );

            let currentDialog = this.getCurrentDialog(session);

            console.log({currentDialog})

            while (currentDialog.next === 'stage') {
              const nextStage = currentDialog.setNextStage;
              await this.sessionService.update(session.id, { leadStage: nextStage });
              currentDialog = dialogsConfig[nextStage];
              const reply: ConversationReply = this.parseDialogToConversationReply(currentDialog, leadId);
              await this.sendMessage(reply);
            }
            if (currentDialog.next === 'reply') {
              const reply: ConversationReply = this.parseDialogToConversationReply(currentDialog, leadId);
              await this.sendMessage(reply);
            }
          })();
        }
      })
      .catch((error) => {
        console.log('erroring finding session', error);
        console.error('Error finding lead:', error);
        this.sendMessage(this.getErrorReply(leadId));
      });
  }

  getCurrentDialog(session: ISession): DialogConfig {
    const currentStage = session.leadStage;
    const dialog = dialogsConfig[currentStage] || { message: 'No dialog found for this stage.', replies: [], next: null, setNextStage: null };

    return dialog;
  }

  getNextDialog(session: ISession, incomingMessage: string): DialogConfig {
    
    const currentStage = session.leadStage 
    console.log(dialogsConfig)
    const dialog = dialogsConfig[currentStage] 
    console.log({dialog})

    if(dialog.next === 'reply') {
      
      const replyIdentifiers = dialog.replies.identifiers
      console.log({replyIdentifiers})
      const [message, nextStage] = incomingMessage.split(':');
      for (const replyIdentifier of replyIdentifiers) {
        if (message.includes(replyIdentifier)){
          this.sessionService.update(session.id, { leadStage: nextStage });
          return dialogsConfig[nextStage];
        }
      }
    } else if (dialog.next === 'stage') {
      // If the dialog is set to 'stage', we need to update the session with the next stage
      const nextStage = dialog.setNextStage;
      this.sessionService.update(session.id, { leadStage: nextStage });
      return dialogsConfig[nextStage];
    }

    return this.getEmptyDialog();
  }

  getEmptyDialog(): DialogConfig {
    const emptyDialog: DialogConfig = {
      message: '',  
      replies: [],
      next: null, // 'stage' or 'reply'
      setNextStage: null, // Optional next stage to set
    };
    return emptyDialog;
  }

  // findAll() {
  //   return `This action returns all chat`;
  // }

  // findOne(id: number) {
  //   return `This action returns a #${id} chat`;
  // }

  // update(id: number, updateChatDto: UpdateChatDto) {
  //   return `This action updates a #${id} chat`;
  // }

  // remove(id: number) {
  //   return `This action removes a #${id} chat`;
  // }
}
  // remove(id: number) {
  //   return `This action removes a #${id} chat`;
  // }

